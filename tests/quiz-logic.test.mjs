import assert from 'node:assert/strict';
import test from 'node:test';
import { isQuizHost, isValidRoomCode, normalizeRoomCode } from '../src/lib/quiz-validation.ts';
import { displayNameFromMetadata } from '../src/lib/profile-name.ts';
import { remainingQuestionSeconds } from '../src/lib/quiz-timer.ts';
import { filterQuizQuestions } from '../src/lib/quiz-filter.ts';

test('normalizes room codes by trimming and uppercasing', () => {
  assert.equal(normalizeRoomCode('  a1b2c3  '), 'A1B2C3');
  assert.equal(normalizeRoomCode(null), '');
});

test('accepts only six alphanumeric room-code characters', () => {
  assert.equal(isValidRoomCode('A1B2C3'), true);
  assert.equal(isValidRoomCode('A1B2C'), false);
  assert.equal(isValidRoomCode('A1B2-3'), false);
  assert.equal(isValidRoomCode(''), false);
});

test('permits quiz management only for the matching host', () => {
  assert.equal(isQuizHost('host-user', 'host-user'), true);
  assert.equal(isQuizHost('host-user', 'other-user'), false);
  assert.equal(isQuizHost(null, 'host-user'), false);
});

test('counts down from the question start and handles a missing timestamp', () => {
  const startedAt = '2026-10-02T12:00:00.000Z';
  const now = Date.parse(startedAt);
  assert.equal(remainingQuestionSeconds(20, startedAt, now), 20);
  assert.equal(remainingQuestionSeconds(20, startedAt, now + 5_001), 15);
  assert.equal(remainingQuestionSeconds(20, startedAt, now + 25_000), 0);
  assert.equal(remainingQuestionSeconds(20, null, now), 20);
});

test('reads names from signup and common OAuth metadata fields', () => {
  assert.equal(displayNameFromMetadata({ name: '  Maya  ' }), 'Maya');
  assert.equal(displayNameFromMetadata({ full_name: 'Maya Singh' }), 'Maya Singh');
  assert.equal(displayNameFromMetadata({ name: '', display_name: 'Maya S.' }), 'Maya S.');
  assert.equal(displayNameFromMetadata({}), null);
});

test('filters quiz questions by topic and text without including other categories', () => {
  const questions = [
    { id: 'zoology-1', topic_id: 'zoology', question_text: 'Animal cells', difficulty: 'medium', topics: { name: 'Zoology' } },
    { id: 'botany-1', topic_id: 'botany', question_text: 'Plant cells', difficulty: 'easy', topics: { name: 'Botany' } },
    { id: 'other-1', topic_id: null, question_text: 'Capital cities', difficulty: 'hard', topics: null },
  ];

  assert.deepEqual(filterQuizQuestions(questions, 'zoology', '').map(question => question.id), ['zoology-1']);
  assert.deepEqual(filterQuizQuestions(questions, 'all', 'plant').map(question => question.id), ['botany-1']);
  assert.deepEqual(filterQuizQuestions(questions, 'uncategorized', '').map(question => question.id), ['other-1']);
});