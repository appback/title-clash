export function shortId(uuid) {
  if (!uuid) return '#------'
  return '#' + uuid.substring(0, 6).toUpperCase()
}
