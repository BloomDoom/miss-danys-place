// Turns technical errors into plain English for the screen.
// The real error is still printed in the browser console for you.

function isConnectionProblem(error) {
  // Safari says "Load failed", Chrome says "Failed to fetch".
  const message = error?.message || ''
  return !navigator.onLine || message.includes('Load failed') || message.includes('Failed to fetch')
}

export function saveErrorMessage(error) {
  console.error(error)
  return isConnectionProblem(error)
    ? "No internet. Your changes weren't saved. Try again."
    : "Something went wrong. Your changes weren't saved. Try again."
}

export function loadErrorMessage(error) {
  console.error(error)
  return isConnectionProblem(error)
    ? 'No internet. Connect to Wi-Fi and try again.'
    : "Something went wrong and this couldn't load. Try again."
}
