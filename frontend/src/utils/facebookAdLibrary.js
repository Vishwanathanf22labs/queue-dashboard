export const generateFacebookAdLibraryUrl = (pageId) => {
  if (!pageId) {
    return null;
  }

  const baseUrl = 'https://www.facebook.com/ads/library/';
  const params = new URLSearchParams({
    active_status: 'active',
    ad_type: 'all',
    country: 'ALL',
    is_targeted_country: 'false',
    media_type: 'all',
    search_type: 'page',
    view_all_page_id: pageId.toString()
  });

  return `${baseUrl}?${params.toString()}`;
};

export const openFacebookAdLibrary = (pageId) => {
  const url = generateFacebookAdLibraryUrl(pageId);
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
};
