import LoadingState from './LoadingState';

const PageLoading = ({ 
  type = 'default', // 'default', 'dashboard', 'table', 'form', 'page'
  message = 'Loading...',
  className = ''
}) => {
  // All types now use the same simple spinner loading
  return <LoadingState message={message} className={className} />;
};

export default PageLoading;
