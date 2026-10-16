import { redirect } from "next/navigation";

// The main link is the host's entry point: /admin shows the login page until an admin is signed in,
// then the console (with the Projector link). Players join from the QR code at /play.
export default function Home() {
  redirect("/admin");
}
