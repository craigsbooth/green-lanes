export default function NotFound() {
  return (
    <div className="h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center max-w-md px-6">
        <h1 className="text-4xl font-bold text-gray-800 mb-2">404</h1>
        <p className="text-sm text-gray-600 mb-4">Page not found.</p>
        <a
          href="/"
          className="inline-block px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"
        >
          Back to map
        </a>
      </div>
    </div>
  );
}
