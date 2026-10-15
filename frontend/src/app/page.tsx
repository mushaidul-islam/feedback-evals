import { redirect } from 'next/navigation';

// There is no home page yet: the dashboard is the app. Signed-out visitors
// are sent on to /login by proxy.ts.
export default function Home() {
  redirect('/c');
}
