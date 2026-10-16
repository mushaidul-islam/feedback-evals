// Name of the http-only cookie that holds a creator's session token. Kept in
// its own file because proxy.ts needs it and cannot import server-only code.
export const SESSION_COOKIE = 'tbt_session';
