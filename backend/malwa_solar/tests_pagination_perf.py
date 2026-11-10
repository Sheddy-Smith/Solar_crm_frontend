from django.test import SimpleTestCase


class PaginationDefaultsTests(SimpleTestCase):
    def test_default_page_size_is_25(self):
        from malwa_solar.pagination import DefaultPagination
        self.assertEqual(DefaultPagination.page_size, 25)
        self.assertEqual(DefaultPagination.page_size_query_param, 'page_size')
        self.assertEqual(DefaultPagination.max_page_size, 100)

    def test_project_viewset_has_won_only_and_pipeline_summary(self):
        import inspect
        from apps.projects.views import ProjectViewSet, PmPipelineViewSet
        src = inspect.getsource(ProjectViewSet.get_queryset)
        self.assertIn('won_only', src)
        self.assertIn('lead_status', src)
        self.assertIn('pm_stage', src)
        self.assertTrue(hasattr(PmPipelineViewSet, 'summary'))
        summary_src = inspect.getsource(PmPipelineViewSet.summary)
        self.assertIn('stages', summary_src)
        self.assertIn('lead_owner_filter', summary_src)
