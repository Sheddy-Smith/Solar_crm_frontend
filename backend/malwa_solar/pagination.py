import os

from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Honours the frontend's ?page_size=N requests (capped) instead of
    silently ignoring them and truncating every list at PAGE_SIZE."""
    # Default 25 keeps CRM list screens light; clients may still request up to max.
    page_size = int(os.environ.get('API_PAGE_SIZE', '25') or 25)
    page_size_query_param = 'page_size'
    # Keep max modest — large pages freeze the browser and stress workers.
    max_page_size = int(os.environ.get('API_MAX_PAGE_SIZE', '100') or 100)
