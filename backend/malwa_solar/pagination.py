from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Honours the frontend's ?page_size=N requests (capped) instead of
    silently ignoring them and truncating every list at PAGE_SIZE."""
    page_size = 100
    page_size_query_param = 'page_size'
    max_page_size = 1000
