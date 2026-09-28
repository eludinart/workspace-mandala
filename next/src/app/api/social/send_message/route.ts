/**
 * POST /api/social/send_message
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-auth'
import { isDbConfigured } from '@/lib/db'
import {
  sendChannelMessage,
  createClairiereMessageNotification,
  getChannelRecipientIds,
} from '@/lib/db-social'
import { addStubMessage } from '@/lib/social-stub-store'
import { removeUpload, saveUpload } from '@/lib/resource-files'
import {
  chatFileError,
  chatFileKind,
  resolveChatFileMime,
  safeAttachmentName,
} from '@/lib/chat-attachments'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Incoming = {
  channelId: number
  text: string
  cardSlug: string | null
  file: File | null
  replyToId: number | null
}

function parseReplyToId(raw: unknown): number | null {
  const n = parseInt(String(raw ?? ''), 10)
  return Number.isFinite(n) && n > 0 ? n : null
}

async function readIncoming(req: NextRequest): Promise<Incoming> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('multipart/form-data')) {
    const form = await req.formData()
    const channelId = parseInt(String(form.get('channelId') ?? form.get('channel_id') ?? ''), 10)
    const text = String(form.get('body') ?? '')
    const cardRaw = form.get('cardSlug') ?? form.get('card_slug')
    const cardSlug = cardRaw ? String(cardRaw) : null
    const fileValue = form.get('file')
    const file = fileValue instanceof File && fileValue.size > 0 ? fileValue : null
    return {
      channelId: Number.isFinite(channelId) ? channelId : 0,
      text,
      cardSlug,
      file,
      replyToId: parseReplyToId(form.get('replyToId') ?? form.get('reply_to_id')),
    }
  }
  const body = (await req.json()) as {
    channelId?: number
    channel_id?: number
    body?: string
    cardSlug?: string
    card_slug?: string
    replyToId?: number
    reply_to_id?: number
  }
  return {
    channelId: body.channelId ?? body.channel_id ?? 0,
    text: body.body ?? '',
    cardSlug: body.cardSlug ?? body.card_slug ?? null,
    file: null,
    replyToId: parseReplyToId(body.replyToId ?? body.reply_to_id),
  }
}

export async function POST(req: NextRequest) {
  let storedPath: string | null = null
  try {
    const { userId } = await requireAuth(req)
    const { channelId, text, cardSlug, file, replyToId } = await readIncoming(req)

    if (!channelId) {
      return NextResponse.json({ error: 'channelId requis' }, { status: 400 })
    }
    if (!text?.trim() && !cardSlug?.trim() && !file) {
      return NextResponse.json({ error: 'body ou cardSlug requis' }, { status: 400 })
    }

    const senderId = parseInt(userId, 10)
    if (!senderId) {
      return NextResponse.json({ error: 'Utilisateur non identifié' }, { status: 400 })
    }

    if (!isDbConfigured()) {
      if (file) {
        return NextResponse.json({ error: 'Backend non configuré' }, { status: 503 })
      }
      const now = new Date().toISOString()
      const msgId = Date.now()
      const msg = {
        id: msgId,
        messageId: msgId,
        senderId,
        body: text?.trim() || null,
        cardSlug: cardSlug?.trim() || null,
        attachment: null,
        temperature: 'calm' as const,
        createdAt: now,
      }
      addStubMessage(channelId, { ...msg })
      return NextResponse.json(msg, { status: 201 })
    }

    let attachment: { path: string; mime: string; name: string; size: number } | null = null
    if (file) {
      const mime = resolveChatFileMime(file)
      const problem = chatFileError({ type: mime, name: file.name, size: file.size })
      if (problem) return NextResponse.json({ error: problem }, { status: 400 })
      const bytes = Buffer.from(await file.arrayBuffer())
      storedPath = await saveUpload(bytes, mime)
      attachment = {
        path: storedPath,
        mime,
        name: safeAttachmentName(file.name),
        size: file.size,
      }
    }

    const msg = await sendChannelMessage(channelId, senderId, {
      body: text?.trim() || null,
      cardSlug: cardSlug?.trim() || null,
      attachment,
      replyToId,
    })
    storedPath = null
    const recipientIds = await getChannelRecipientIds(channelId, senderId)
    const noticeBody =
      msg.body ||
      (msg.attachment
        ? chatFileKind(msg.attachment.mime) === 'image'
          ? 'Photo'
          : msg.attachment.name
        : null)
    for (const recipientId of recipientIds) {
      createClairiereMessageNotification(
        channelId,
        senderId,
        recipientId,
        noticeBody,
        msg.cardSlug
      ).catch(() => {})
    }
    return NextResponse.json(
      {
        id: msg.id,
        messageId: msg.id,
        senderId: msg.senderId,
        body: msg.body,
        cardSlug: msg.cardSlug,
        attachment: msg.attachment ?? null,
        temperature: msg.temperature,
        createdAt: msg.createdAt,
        replyTo: msg.replyTo ?? null,
      },
      { status: 201 }
    )
  } catch (err: unknown) {
    if (storedPath) await removeUpload(storedPath)
    const e = err as { status?: number; message?: string }
    return NextResponse.json({ error: e.message }, { status: e.status || 401 })
  }
}
