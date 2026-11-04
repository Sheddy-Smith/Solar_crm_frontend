import os

from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Honours the frontend's ?page_size=N requests (capped) instead of
    silently ignoring them and truncating every list at PAGE_SIZE."""
    page_size = int(os.environ.get('API_PAGE_SIZE', '100') or 100)
    page_size_query_param = 'page_size'
    # Keep max modest — 2500 rows per request can DoS workers under load.
    max_page_size = int(os.environ.get('API_MAX_PAGE_SIZE', '200') or 200)
