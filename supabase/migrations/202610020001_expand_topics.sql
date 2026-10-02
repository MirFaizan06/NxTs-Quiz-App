insert into public.topics (name, description)
select seed.name, seed.description
from (values
  ('Programming', 'Programming languages, algorithms, and software development'),
  ('Computer Science', 'Databases, operating systems, networking, and computing theory'),
  ('Mathematics', 'Algebra, calculus, geometry, probability, and statistics'),
  ('Physics', 'Mechanics, energy, electromagnetism, and modern physics'),
  ('Chemistry', 'Matter, reactions, elements, and chemical principles'),
  ('Biology', 'Life sciences, cells, genetics, and organisms'),
  ('Zoology', 'Animal biology, anatomy, behavior, and classification'),
  ('Botany', 'Plant biology, anatomy, physiology, and classification'),
  ('Geography', 'Physical geography, countries, maps, climate, and places'),
  ('General Knowledge', 'Cross-disciplinary facts, culture, and current affairs'),
  ('Astronomy', 'Space, planets, stars, and the universe'),
  ('Environmental Science', 'Ecosystems, conservation, climate, and sustainability'),
  ('Education', 'Teaching, learning, educational systems, and assessment'),
  ('Sociology', 'Society, social behavior, institutions, and social change'),
  ('Economics', 'Markets, resources, production, trade, and economic systems'),
  ('Philosophy', 'Ethics, logic, knowledge, and philosophical traditions'),
  ('Psychology', 'Cognition, emotion, behavior, and mental processes')
) as seed(name, description)
where not exists (
  select 1 from public.topics existing
  where lower(trim(existing.name)) = lower(trim(seed.name))
);