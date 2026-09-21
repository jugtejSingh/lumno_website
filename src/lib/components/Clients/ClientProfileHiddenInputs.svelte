<script lang="ts">
	import type { ClientProfile } from '$lib/clientProfile';

	// Mirrors a ClientProfileFields (named={false}) into one of several forms on a page.
	let { profile }: { profile: ClientProfile } = $props();
</script>

<input type="hidden" name="dateOfBirth" value={profile.dateOfBirth} />
<input type="hidden" name="gender" value={profile.gender} />
<input type="hidden" name="city" value={profile.city} />
<input type="hidden" name="state" value={profile.state} />
<input type="hidden" name="country" value={profile.country} />
