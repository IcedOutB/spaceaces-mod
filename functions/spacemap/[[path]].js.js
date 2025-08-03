export async function onRequest(context) {
  // Middleware already validated the user.
  return context.next(); // Let Pages serve the file
}
