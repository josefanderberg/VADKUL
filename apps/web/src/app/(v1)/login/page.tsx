import { redirect } from 'next/navigation';

/**
 * Gamla login-sidan är skrotad — inloggning sker i en modal på kartan.
 * Gamla länkar (delningar, bokmärken) landar mjukt på kartan i stället för 404.
 */
export default function LoginPage() {
    redirect('/');
}
