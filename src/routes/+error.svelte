<script>
  import { page } from '$app/stores';
  import ErrorState from '$lib/ErrorState.svelte';

  const status = $derived($page.status);
  const notFound = $derived(status === 404);

  const title = $derived(
    notFound ? 'Page not found' : status >= 500 ? 'Something broke' : 'Something went wrong'
  );
  const message = $derived(
    notFound
      ? "That tool doesn't exist. It may have moved, or the link was mistyped."
      : $page.error?.message || 'An unexpected error occurred. Please try again.'
  );
</script>

<svelte:head>
  <title>{notFound ? 'Not found' : 'Error'} — MeshCore Tools</title>
</svelte:head>

<ErrorState kind={notFound ? 'notfound' : 'error'} {title} {message} />
