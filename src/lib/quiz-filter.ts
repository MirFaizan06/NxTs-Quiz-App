export type TopicQuestion = {
  topic_id: string | null;
  question_text: string;
  difficulty: string;
  topics?: { name: string } | null;
};

export function filterQuizQuestions<T extends TopicQuestion>(
  questions: T[],
  topicFilter: string,
  search: string
): T[] {
  const query = search.trim().toLowerCase();

  return questions.filter(question => {
    const matchesTopic = topicFilter === 'all'
      || (topicFilter === 'uncategorized' && !question.topic_id)
      || question.topic_id === topicFilter;
    const matchesSearch = !query
      || question.question_text.toLowerCase().includes(query)
      || question.difficulty.toLowerCase().includes(query)
      || (question.topics?.name ?? '').toLowerCase().includes(query);

    return matchesTopic && matchesSearch;
  });
}