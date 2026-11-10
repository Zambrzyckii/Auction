// Header and payload of a real token issued by the local stack; the signature is irrelevant
// for decoding, so it is replaced with a dummy segment.
export const REAL_TOKEN =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJ1bmlxdWVfbmFtZSI6InByb2JlMUB0ZXN0LmxvY2FsIiwibmFtZWlkIjoiMjZhNDUxZDQtZGQ3NC00YTU4LTg1OWYtNjM2YWNhMjU4NDQzIiwicm9sZSI6IlVzZXIiLCJuYmYiOjE3OTQxNDgxNjcsImV4cCI6MTc5NDE0OTA2NywiaWF0IjoxNzk0MTQ4MTY3LCJpc3MiOiJBdWN0aW9uU2VydmVyIiwiYXVkIjoiQXVjdGlvblNlcnZlci5DbGllbnQifQ.' +
  'x';

export const REAL_TOKEN_USER_ID = '26a451d4-dd74-4a58-859f-636aca258443';
export const REAL_TOKEN_EMAIL = 'probe1@test.local';
export const REAL_TOKEN_EXP = 1794149067;
