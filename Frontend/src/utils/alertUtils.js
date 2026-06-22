export const showAlert = (message, type = 'info') => {
  window.dispatchEvent(new CustomEvent('ang:alert', { detail: { message, type } }))
}
