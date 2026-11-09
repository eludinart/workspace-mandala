# Review package Task 3
Base: 8f9f34b5e54ca06b08fd6038defeb71c40cd1b14
Head: ba6f2ebbd5aadd407ada3064e95de4bc5c216134

## Commits
ba6f2eb feat(pull-refresh): brancher PullToRefresh sur le Layout

## Stat
 next/src/components/layout/Layout.tsx | 12 +++++++++---
 1 file changed, 9 insertions(+), 3 deletions(-)

## Diff
diff --git a/next/src/components/layout/Layout.tsx b/next/src/components/layout/Layout.tsx
index 3db4b94..f26a598 100644
--- a/next/src/components/layout/Layout.tsx
+++ b/next/src/components/layout/Layout.tsx
@@ -10,20 +10,21 @@ import { AppHeader } from '@/components/layout/AppHeader'
 import { PlaceSwitchBanner } from '@/components/layout/PlaceSwitchBanner'
 import { BillingCompExpiryBanner } from '@/components/billing/BillingCompExpiryBanner'
 import { CheckoutReturnBanner } from '@/components/billing/CheckoutReturnBanner'
 import { AdminActingRoleBar } from '@/components/AdminActingRoleBar'
 import { BottomNav } from '@/components/layout/BottomNav'
 import { AppNavPanel } from '@/components/layout/AppNavPanel'
 import { MobileNavDrawer } from '@/components/layout/MobileNavDrawer'
 import { InstallAppPrompt } from '@/components/InstallAppPrompt'
 import { PushNotificationPriming } from '@/components/PushNotificationPriming'
 import { HelpButton } from '@/components/help/HelpButton'
+import { PullToRefresh } from '@/components/PullToRefresh'
 import type { CheckoutReturnState } from '@/lib/checkout-return'
 import { useEffect, useState } from 'react'
 
 export function Layout({
   page,
   onNavigate,
   adminTab,
   onBack,
   checkoutReturn,
   onDismissCheckoutReturn,
@@ -112,25 +113,30 @@ export function Layout({
             state={checkoutReturn}
             onNavigate={onNavigate}
             onDismiss={onDismissCheckoutReturn}
           />
         )}
         <BillingCompExpiryBanner onNavigate={onNavigate} />
         <AdminActingRoleBar />
         <InstallAppPrompt />
         <PushNotificationPriming />
         <main
-          className={`flex-1 min-h-0 min-w-0 w-full ${
-            page === 'home' ? 'overflow-auto p-0' : 'overflow-auto p-4 md:p-6'
+          className={`flex-1 min-h-0 min-w-0 w-full flex flex-col ${
+            page === 'home' ? 'p-0' : 'p-0'
           }`}
         >
-          {children}
+          <PullToRefresh
+            page={page}
+            className={`flex-1 overflow-auto ${page === 'home' ? 'p-0' : 'p-4 md:p-6'}`}
+          >
+            {children}
+          </PullToRefresh>
         </main>
         <BottomNav page={page} onNavigate={onNavigate} />
         <HelpButton page={page} />
       </div>
       <MobileNavDrawer
         open={mobileNavOpen}
         onClose={() => setMobileNavOpen(false)}
         page={page}
         onNavigate={onNavigate}
         adminTab={adminTab}

