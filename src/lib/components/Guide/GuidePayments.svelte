<script lang="ts">
	import GuideSection from './GuideSection.svelte';
	import GuideCallout from './GuideCallout.svelte';

	let { id, number }: { id: string; number: number } = $props();
</script>

<GuideSection
	{id}
	{number}
	title="Payments"
	intro="Every session turns into an invoice automatically, so you always know who owes what. Clients see their invoices in the portal, next to the details they need to pay you."
>
	<h3>How invoices are created</h3>
	<p>
		Each booked session, whether you added it or the client booked it, creates an unpaid invoice at
		that client's rate, unless it uses a pack credit (see below). For anything else (a report or a
		missed session, for example), press <strong>+ Add charge</strong> on <a href="/payments">Payments</a>, choose a client
		or type a name, and enter the amount and a note.
	</p>

	<h3>The Payments page</h3>
	<ul>
		<li><strong>Paid, unpaid and total this month</strong> at the top.</li>
		<li>
			<strong>Who owes what</strong>: everyone with an outstanding balance. Click a name to see their
			invoices, then mark them paid, change the amount or note, or delete them.
		</li>
		<li>
			The client list on the side opens anyone's full payment history, even if they don't owe
			anything.
		</li>
	</ul>

	<h3>Showing clients how to pay you: QR code and bank details</h3>
	<p>
		In <a href="/settings">Settings → Manual Payment Methods</a>, upload a photo of your UPI / payment QR
		code (PNG, JPEG or WebP, under 5 MB) and type in your bank or UPI details. Whenever a client has
		something to pay, both are shown in their portal under <strong>How to pay</strong>.
	</p>
	<GuideCallout title="Remember to mark these paid">
		<p>
			Money sent by QR code or bank transfer goes straight to you, so the app can't see it arrive.
			When the client tells you they've paid, mark the invoice paid on
			<a href="/payments">Payments</a>. The same goes for cash.
		</p>
	</GuideCallout>

	<h3>Letting clients pay online with Razorpay</h3>
	<p>
		If your practice charges in INR, connect your own Razorpay account in
		<a href="/settings">Settings → Online Payments (Razorpay)</a> and turn on
		<strong>Let clients pay invoices in the portal with Razorpay</strong>. Clients then get a
		<strong>Pay now</strong> button (card or UPI) on each invoice. The money goes to your Razorpay
		account, and the invoice is marked paid for you. We take 0% commission. Razorpay may charge its
		own processing fee.
	</p>
	<p>
		If a client pays online for an invoice you'd already marked paid by hand, a red alert on Payments
		tells you, so you can refund the double payment from your Razorpay dashboard.
	</p>

	<h3>Cancellation and reschedule fees</h3>
	<p>
		Cancelling and rescheduling each have their own policy in
		<a href="/settings">Settings → Payment Setup</a>. For cancellations, two windows decide the fee:
	</p>
	<ul>
		<li>
			<strong>50% window</strong>: cancelling or moving within this long before the session costs
			half the client's rate. Earlier than that is free, and 0 hours means no charge before the
			session starts.
		</li>
		<li>
			<strong>100% window</strong>: within this long before the session, the fee is the full rate.
			You can also skip the 50% step.
		</li>
	</ul>
	<p>
		Example: a 24-hour 50% window and a 2-hour 100% window. Cancelling two days ahead costs nothing,
		cancelling 10 hours ahead costs half, and cancelling an hour before costs the full rate. Fees are
		added as invoices automatically, and you can edit or delete them like any other invoice.
	</p>
	<p>
		Rescheduling is free unless you turn on <strong>Charge for rescheduling</strong>. It then gets
		its own 50% and 100% windows, which work the same way but are set separately from the
		cancellation ones. Clients see both policies in their portal.
	</p>

	<h3>Session packs</h3>
	<p>
		For a client who pays for several sessions up front, press <strong>+ Add pack</strong> on
		<a href="/payments">Payments</a>. Choose the client, the number of sessions and the total price,
		and tick <strong>Already paid</strong> if they've paid. Otherwise the pack's price shows as an
		unpaid invoice. The pack can be used straight away either way.
	</p>
	<ul>
		<li>A client can have one active pack at a time.</li>
		<li>
			Sessions the client books in their portal, and sessions on a slot reserved for them, use a pack
			credit instead of creating an invoice. Sessions you add yourself on the Calendar don't use the
			pack.
		</li>
		<li>
			Cancelling or moving a pack session for free or inside the 50% window gives the credit back.
			Inside the 100% window the credit is used up. Pack sessions never get a separate fee invoice.
		</li>
		<li>
			When the pack runs out, the client's next sessions are invoiced at their normal rate. The
			<strong>Packs</strong> list on Payments shows how many sessions each client has left.
		</li>
	</ul>

	<h3>Blocking bookings until the balance is paid</h3>
	<p>
		Turn on <strong>Block portal bookings while a client owes you money</strong> in
		<a href="/settings">Settings → Booking Rules</a> and a client with any unpaid invoice can't book
		from their portal until it's settled.
	</p>
</GuideSection>
