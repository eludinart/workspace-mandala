# Review Task 6
Base: 6ea709423766231d9d4f9afd6c4a84819527a4e6
Head: 71bca4f0edbf0123eac762dd2d0ae7f5dcb031af

## Commits
71bca4f feat(pull-refresh): Messages liste et fil

## Stat
 next/src/components/social/DialogueStream.tsx | 30 ++++++++++++++++++++-------
 next/src/views/MessagesPage.tsx               | 26 ++++++++++++++++++-----
 2 files changed, 44 insertions(+), 12 deletions(-)

## Diff
diff --git a/next/src/components/social/DialogueStream.tsx b/next/src/components/social/DialogueStream.tsx
index 9b66dd4..5fe9833 100644
--- a/next/src/components/social/DialogueStream.tsx
+++ b/next/src/components/social/DialogueStream.tsx
@@ -23,16 +23,17 @@ import {
   isChatImagePreview,
   messageReplyExcerpt,
   resolveChatFileMime,
   type MessageReplyQuote,
 } from '@/lib/chat-attachments'
 import { ApiError } from '@/lib/api-client'
 import { moderationApi } from '@/api/moderation'
 import { ReportContentDialog } from '@/components/moderation/ReportContentDialog'
+import { PullToRefresh } from '@/components/PullToRefresh'
 
 export function DialogueStream({
   channelId,
   otherPseudo,
   otherAvatar,
   otherAvatarEmoji,
   otherIsOnline = false,
   isGroup = false,
@@ -119,17 +120,27 @@ export function DialogueStream({
   const [reportOpen, setReportOpen] = useState(false)
   const [blockBusy, setBlockBusy] = useState(false)
   const [blockMsg, setBlockMsg] = useState<string | null>(null)
   const [unreadFromId, setUnreadFromId] = useState<number | null>(null)
   const [unreadCount, setUnreadCount] = useState(0)
   const [replyDraft, setReplyDraft] = useState<MessageReplyQuote | null>(null)
   const [highlightId, setHighlightId] = useState<number | null>(null)
   const [readCursorReady, setReadCursorReady] = useState(false)
-  const listRef = useRef<HTMLDivElement>(null)
+  const listAnchorRef = useRef<HTMLDivElement>(null)
+
+  const getListScrollEl = useCallback((): HTMLDivElement | null => {
+    let el = listAnchorRef.current?.parentElement ?? null
+    while (el) {
+      const oy = window.getComputedStyle(el).overflowY
+      if (oy === 'auto' || oy === 'scroll') return el as HTMLDivElement
+      el = el.parentElement
+    }
+    return null
+  }, [])
   const unreadBoundaryRef = useRef<HTMLDivElement>(null)
   const readCursorCaptured = useRef(false)
   const initialScrollDone = useRef(false)
 
   const messages = messagesByChannel[String(channelId)] || []
   const visibleMessages = [...messages, ...pendingMessages]
   const peerLastReadAt = isGroup ? null : peerLastReadAtByChannel[String(channelId)] ?? null
   const canRename =
@@ -210,34 +221,34 @@ export function DialogueStream({
     return () => {
       alive = false
       clearInterval(timer)
       document.removeEventListener('visibilitychange', onVisibility)
     }
   }, [channelId, loadChannelMessages, markChannelRead])
 
   useEffect(() => {
-    const el = listRef.current
+    const el = getListScrollEl()
     if (!el || !readCursorReady || visibleMessages.length === 0) return
     if (!initialScrollDone.current) {
       requestAnimationFrame(() => {
         const boundary = unreadBoundaryRef.current
         if (unreadFromId != null && boundary) {
           const delta = boundary.getBoundingClientRect().top - el.getBoundingClientRect().top
           el.scrollTop += delta - 120
         } else {
           el.scrollTop = el.scrollHeight
         }
         initialScrollDone.current = true
       })
       return
     }
     const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
     if (nearBottom) el.scrollTop = el.scrollHeight
-  }, [readCursorReady, unreadFromId, visibleMessages.length])
+  }, [getListScrollEl, readCursorReady, unreadFromId, visibleMessages.length])
 
   const resolveSender = useCallback(
     (msg: ChannelMessage, isMe: boolean) => {
       if (isMe) {
         return {
           displayName: `${mePseudo} (vous)`,
           avatar: meAvatar,
           avatarEmoji: meAvatarEmoji,
@@ -391,17 +402,17 @@ export function DialogueStream({
                 poll: res.poll,
                 reactions: [],
               },
             ],
           },
         }
       })
       requestAnimationFrame(() => {
-        const el = listRef.current
+        const el = getListScrollEl()
         if (el) el.scrollTop = el.scrollHeight
       })
     } finally {
       setPollBusy(false)
     }
   }
 
   const handleSendText = async () => {
@@ -437,17 +448,17 @@ export function DialogueStream({
     try {
       await sendMessage(channelId, {
         body: text,
         file: attachment ?? undefined,
         replyToId: quoted?.id,
       })
       setReplyDraft(null)
       requestAnimationFrame(() => {
-        const el = listRef.current
+        const el = getListScrollEl()
         if (el) el.scrollTop = el.scrollHeight
       })
     } catch (e: unknown) {
       setInput(text)
       if (attachment) {
         setFile(attachment)
         if (isChatImagePreview(mime)) setFilePreview(URL.createObjectURL(attachment))
       }
@@ -824,17 +835,21 @@ export function DialogueStream({
         open={reportOpen}
         onClose={() => setReportOpen(false)}
         targetType="user"
         targetId={otherUserId ?? 0}
         targetUserId={otherUserId ?? undefined}
         title="Signaler un membre"
       />
 
-      <div ref={listRef} className="m-chat-wallpaper min-h-0 min-w-0 overflow-y-auto overflow-x-hidden px-3 py-3 space-y-1">
+      <PullToRefresh
+        page="messages"
+        className="m-chat-wallpaper min-h-0 min-w-0 overflow-y-auto overflow-x-hidden"
+      >
+        <div ref={listAnchorRef} className="px-3 py-3 space-y-1">
         {visibleMessages.length === 0 && (
           <p className="text-center text-sm text-slate-500 py-16">Envoyez le premier message.</p>
         )}
         {visibleMessages.map((msg, index) => {
           const isMe = msg.senderId === meId
           const itemKey = String(msg.id ?? msg.messageId ?? index)
           const sender = resolveSender(msg, isMe)
           const day = chatDayKey(msg.createdAt)
@@ -889,17 +904,18 @@ export function DialogueStream({
                 onReact={handleReact}
                 onReply={startReply}
                 onJumpTo={jumpToMessage}
                 onPollUpdated={patchPollOnMessage}
               />
             </div>
           )
         })}
-      </div>
+        </div>
+      </PullToRefresh>
 
       <CreatePollSheet
         open={pollOpen}
         busy={pollBusy}
         onClose={() => setPollOpen(false)}
         onSubmit={handleCreatePoll}
       />
 
diff --git a/next/src/views/MessagesPage.tsx b/next/src/views/MessagesPage.tsx
index 495014b..50a30b8 100644
--- a/next/src/views/MessagesPage.tsx
+++ b/next/src/views/MessagesPage.tsx
@@ -9,16 +9,18 @@ import { useCommunity } from '@/contexts/CommunityContext'
 import { useAuth } from '@/contexts/AuthContext'
 import { useSocialStore } from '@/store/useSocialStore'
 import { ApiError } from '@/lib/api-client'
 import { UserAvatar } from '@/components/UserAvatar'
 import { membersApi, type CommunityMember } from '@/api/members'
 import { formatChatListTime } from '@/lib/format-datetime'
 import { isCommunityManagerRole } from '@/lib/community-role-labels'
 import { ExplainCard } from '@/components/help/ExplainCard'
+import { PullToRefresh } from '@/components/PullToRefresh'
+import { useRegisterPullRefresh } from '@/hooks/useRegisterPullRefresh'
 
 type Channel = {
   channelId: number
   channelType: 'direct' | 'group'
   otherUserId?: number
   otherPseudo: string
   otherAvatar?: string | null
   otherAvatarEmoji?: string
@@ -98,18 +100,19 @@ export function MessagesPage({
   const [listTab, setListTab] = useState<'dialogues' | 'members'>('dialogues')
   const [pendingDelete, setPendingDelete] = useState<Channel | null>(null)
   const [deletingConversation, setDeletingConversation] = useState(false)
   const [deleteError, setDeleteError] = useState<string | null>(null)
   const openedForRef = useRef<string | null>(null)
   const openedChannelRef = useRef<string | null>(null)
   const selectedIdRef = useRef<number | null>(null)
 
-  const loadChannels = useCallback(async () => {
-    setLoading(true)
+  const loadChannels = useCallback(async (opts?: { soft?: boolean }) => {
+    const soft = opts?.soft ?? false
+    if (!soft) setLoading(true)
     setError(null)
     try {
       const slug = active?.slug
       const [chData, seedsData, membersData] = await Promise.all([
         socialApi.getMyChannels(slug) as Promise<{ channels?: Channel[] }>,
         socialApi.pendingSeedsIncoming({ limit: 20 }) as Promise<{ items?: PendingSeed[] }>,
         slug
           ? (membersApi.listCommunity(slug) as Promise<{ members?: CommunityMember[] }>)
@@ -123,20 +126,29 @@ export function MessagesPage({
       setPending(seedsData?.items ?? [])
       setMembers(membersData?.members ?? [])
       void fetchClairiereUnread()
       return list
     } catch (e: unknown) {
       setError(e instanceof ApiError ? e.detail : (e as { message?: string })?.message ?? 'Erreur')
       return []
     } finally {
-      setLoading(false)
+      if (!soft) setLoading(false)
     }
   }, [active?.slug, fetchClairiereUnread])
 
+  const onPull = useCallback(async () => {
+    await loadChannels({ soft: true })
+    const id = selectedIdRef.current
+    if (id != null) {
+      await useSocialStore.getState().loadChannelMessages(id)
+    }
+  }, [loadChannels])
+  useRegisterPullRefresh('messages', onPull)
+
   useEffect(() => {
     void loadChannels()
     const t = setInterval(() => void loadChannels(), 60000)
     return () => clearInterval(t)
   }, [loadChannels])
 
   useEffect(() => {
     if (openCommunitySlug && active?.slug !== openCommunitySlug) {
@@ -489,17 +501,21 @@ export function MessagesPage({
                   >
                     Refuser
                   </button>
                 </div>
               ))}
             </section>
           )}
 
-          <div className="flex-1 min-h-0 overflow-y-auto">
+          <PullToRefresh
+            page="messages"
+            className="flex-1 min-h-0 overflow-y-auto"
+            disabled={chatOpen && listTab === 'dialogues'}
+          >
             {loading && channels.length === 0 && (
               <p className="text-slate-500 text-sm text-center py-10">Chargement…</p>
             )}
             {!loading && !error && channels.length === 0 && (
               <div className="px-6 py-12 text-center">
                 <p className="font-serif text-xl text-slate-200">Aucune conversation</p>
                 <p className="text-sm text-slate-500 mt-2">
                   Écrivez à un membre du lieu pour commencer.
@@ -606,17 +622,17 @@ export function MessagesPage({
                     aria-label={`Supprimer la conversation ${ch.otherPseudo}`}
                   >
                     Supprimer
                   </button>
                 )}
                 </div>
               )
             })}
-          </div>
+          </PullToRefresh>
           </>
           )}
         </section>
 
         <section
           className={`${
             listTab === 'members' ? 'hidden lg:flex' : chatOpen ? 'flex' : 'hidden lg:flex'
           } flex-1 min-h-0 min-w-0 flex-col bg-slate-950`}

