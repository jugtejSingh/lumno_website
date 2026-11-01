<script lang="ts">
	import Nav from '$lib/components/utils/Nav.svelte';
	import Footer from '$lib/components/utils/Footer.svelte';
	import Hero from '$lib/components/Home/Hero.svelte';
	import WeekSection from '$lib/components/Home/WeekSection.svelte';
	import FeaturesSection from '$lib/components/Home/FeaturesSection.svelte';
	import CtaBand from '$lib/components/Home/CtaBand.svelte';
	import { features } from '$lib/data/features';
	import TestimonialsSection from '$lib/components/Home/TestimonialsSection.svelte';
	import { testimonials } from '$lib/data/testimonials';
	import PrivacySection from '$lib/components/Home/PrivacySection.svelte';
	import PricingSection from '$lib/components/Home/PricingSection.svelte';
	import FaqSection from '$lib/components/Home/FaqSection.svelte';
</script>

<div class="page">
	<Nav />
	<Hero />
	<WeekSection />
	<FeaturesSection {features} />
	<TestimonialsSection {testimonials} />
	<PrivacySection />
	<PricingSection />
	<FaqSection />
	<CtaBand />
	<Footer />
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--wallpaper) var(--surface-app);
		color: var(--text-primary);
		/* clip, not hidden: hidden makes .page a scroll box, which freezes the week lists' scroll fade */
		overflow-x: clip;
	}
</style>
