import Button from './Button';

const AdminAccessRequired = ({
  title = "Admin Access Required",
  description = "This page requires administrator privileges. Please log in with your admin credentials to access this feature.",
  showLoginButton = false,
  onLoginClick = null
}) => {
  return (
    <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full mx-auto">
      <div className="text-center">

        <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <div className="w-12 h-12 bg-red-500 rounded-full flex items-center justify-center">
            <svg
              className="w-8 h-8 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {title}
        </h2>

        <p className="text-gray-600 text-sm leading-relaxed">
          {description}
        </p>

        {showLoginButton && onLoginClick && (
          <div className="mt-6">
            <Button
              variant="primary"
              onClick={onLoginClick}
              className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              <svg
                className="w-4 h-4 mr-2"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              Login as Admin
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAccessRequired;
