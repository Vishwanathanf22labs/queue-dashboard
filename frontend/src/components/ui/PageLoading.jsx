import LoadingState from './LoadingState';

const PageLoading = ({
  type = 'default',
  message = 'Loading...',
  className = ''
}) => {
  return <LoadingState message={message} className={className} />;
};

export default PageLoading;
