select column_default from information_schema.columns where table_schema='public' and table_name='long_form_visual_world_versions' and column_name='render_tier';
select id, version, render_tier, renderer_tool_key from long_form_visual_world_versions where id in ('973ec40c-82d2-42d8-9090-c6cf469dd3f4','d64cce75-9f0d-49ef-9138-8d35fc45a0b3');
