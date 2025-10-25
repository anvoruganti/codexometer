insert into public.subreddits (name, display_name, reddit_path)
values
    ('chatgpt', 'r/chatgpt', '/r/chatgpt'),
    ('openai', 'r/openai', '/r/openai'),
    ('chatgptpro', 'r/chatgptpro', '/r/chatgptpro'),
    ('codex', 'r/codex', '/r/codex')
on conflict (name) do nothing;
