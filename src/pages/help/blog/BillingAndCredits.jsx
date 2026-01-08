import React from "react";
export default function BillingAndCredits() {
return (
<div>
<h3>Plans and monthly credits</h3>
<p>
Your subscription provides a monthly credit allowance. Credits are consumed when you render
images or videos. If you run out, you can purchase a top‑up; those credits are added on top of
your current balance and never reduce your next month’s allowance.
</p>
<h3>Managing your plan</h3>
<p>
Go to <strong>Settings → Billing</strong> to open the Stripe portal. From there you can upgrade,
downgrade, cancel, or update your payment method. We recommend upgrades go into effect
immediately, while downgrades schedule at period end.
</p>
<h3>How credits are added</h3>
<p>
After Stripe confirms payment, our webhook updates your <em>credit wallet</em> in Supabase. You’ll
see the new balance within seconds on the app header and in Billing → Summary.
</p>
<h3>Invoices and receipts</h3>
<p>
You can find every invoice inside the Stripe portal. We’ll also email a receipt to the address on
your account.
</p>
<h3>Common questions</h3>
<ul>
<li><strong>Do credits expire?</strong> Monthly plan credits reset each cycle; top‑ups don’t expire.</li>
<li><strong>Can I transfer credits?</strong> Not currently—credits are tied to your account.</li>
<li><strong>Refunds?</strong> Contact support and we’ll review on a case‑by‑case basis.</li>
</ul>
</div>
);
}