function fallbackCopyText(text) {
  if (typeof document === 'undefined' || !document.body || typeof document.execCommand !== 'function') {
    return false
  }

  const textArea = document.createElement('textarea')
  const activeElement = document.activeElement

  textArea.value = text
  textArea.setAttribute('readonly', '')
  textArea.setAttribute('aria-hidden', 'true')
  textArea.style.position = 'fixed'
  textArea.style.top = '0'
  textArea.style.left = '-9999px'
  textArea.style.opacity = '0'

  document.body.appendChild(textArea)
  textArea.focus()
  textArea.select()
  textArea.setSelectionRange(0, textArea.value.length)

  let copied = false

  try {
    copied = document.execCommand('copy')
  } finally {
    document.body.removeChild(textArea)
    activeElement?.focus?.()
  }

  return copied
}

export async function copyTextToClipboard(text) {
  const value = text == null ? '' : String(text)
  let clipboardError = null

  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value)
      return true
    } catch (error) {
      clipboardError = error
    }
  }

  if (fallbackCopyText(value)) {
    return true
  }

  throw clipboardError || new Error('Clipboard copy failed.')
}

export { fallbackCopyText }
