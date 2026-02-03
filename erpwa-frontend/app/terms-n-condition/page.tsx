import { Metadata } from "next";
import { Logo } from "@/components/logo";
import Link from "next/link";

export const metadata: Metadata = {
    title: "Terms and Conditions | GPS-ERP",
    description:
        "Terms and Conditions for GPS-ERP WhatsApp Business Integration Platform",
};

export default function TermsAndConditionsPage() {
    const currentYear = new Date().getFullYear();

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="w-full bg-card border-b border-border py-4 sticky top-0 z-50 shadow-sm">
                <div className="container mx-auto px-4 md:px-6 flex items-center justify-between">
                    <Link
                        href="/"
                        className="flex items-center gap-2 transition-opacity hover:opacity-80"
                    >
                        <Logo className="h-10 w-auto" isSidebar={true} collapsed={false} />
                    </Link>
                    <nav>
                        <Link
                            href="/"
                            className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
                        >
                            Back to Home
                        </Link>
                    </nav>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 container mx-auto px-4 md:px-6 py-12">
                <div className="max-w-4xl mx-auto bg-card rounded-2xl shadow-sm border border-border overflow-hidden">
                    <div className="p-8 md:p-12">
                        <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                            Terms and Conditions
                        </h1>
                        <p className="text-muted-foreground mb-8 text-sm">
                            Last updated: {currentYear}
                        </p>

                        <div className="space-y-8 text-foreground leading-relaxed">
                            <section>
                                <p className="mb-4">
                                    Welcome to GPS-ERP (&quot;we&quot;, &quot;our&quot;, &quot;us&quot;).
                                    These Terms and Conditions govern your use of our application and services,
                                    specifically focusing on our integration with the <strong>WhatsApp Business Platform</strong>.
                                    By accessing or using our services, you agree to comply with these terms, as well as Meta&apos;s applicable policies.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">
                                    Acceptance of Terms
                                </h2>
                                <p className="mb-4 text-muted-foreground">
                                    By registering for and using our platform, you acknowledge that you have read, understood, and agree to be bound by these Terms and Conditions. If you do not agree with any part of these terms, you must not use our services.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">
                                    Meta Business Messaging Compliance
                                </h2>
                                <p className="mb-4 text-muted-foreground">
                                    Our platform strictly adheres to the <a href="https://developers.facebook.com/documentation/business-messaging/whatsapp/overview" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Business Messaging Policy</a>. To maintain a healthy ecosystem, all potential users must ensure their messaging practices comply with Meta&apos;s standards.
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>
                                        <strong>Opt-In Consent:</strong> You must obtain clear, verifiable opt-in consent from users before sending them messages.
                                    </li>
                                    <li>
                                        <strong>Quality Messaging:</strong> Messages should be expected, relevant, and timely. High block rates or spam reports may lead to account restrictions.
                                    </li>
                                    <li>
                                        <strong>Prohibited Content:</strong> You may not use the platform to send content that violates Meta&apos;s Commerce Policy or Community Standards (e.g., illegal goods, discrimination, fraud).
                                    </li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">
                                    User Responsibilities
                                </h2>
                                <p className="mb-4 text-muted-foreground">
                                    As a user of our platform, you are responsible for:
                                </p>
                                <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                                    <li>Maintaining the confidentiality of your account credentials.</li>
                                    <li>Ensuring all data provided to us is accurate and up-to-date.</li>
                                    <li>Assuming full liability for the content of messages sent through your account.</li>
                                    <li>Managing your WhatsApp Business Account (WABA) in accordance with WhatsApp&apos;s terms.</li>
                                </ul>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">
                                    Service Usage & Restrictions
                                </h2>
                                <p className="mb-4 text-muted-foreground">
                                    Reference to the <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Meta Platform Terms</a>, you agree NOT to:
                                </p>
                                <div className="p-4 bg-secondary/30 rounded-lg border border-secondary text-sm font-medium space-y-2">
                                    <p>1. Send unsolicited bulk messaging or spam.</p>
                                    <p>2. Reverse engineer, decompile, or attempt to extract source code from our platform.</p>
                                    <p>3. Use the service for any illegal or unauthorized purpose.</p>
                                </div>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">
                                    Termination
                                </h2>
                                <p className="text-muted-foreground">
                                    We reserve the right to suspend or terminate your access to the service immediately, without prior notice or liability, for any reason whatsoever, including without limitation if you breach the Terms.
                                </p>
                                <p className="mt-2 text-muted-foreground">
                                    Repeated violations of WhatsApp&apos;s policies or high negative feedback from users will result in immediate service suspension to protect the integrity of the ecosystem.
                                </p>
                            </section>

                            <section>
                                <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">
                                    Changes to Terms
                                </h2>
                                <p className="text-muted-foreground">
                                    We reserve the right to modify these terms at any time. We will notify you of any changes by posting the new Terms and Conditions on this page. Your continued use of the service after any such changes constitutes your acceptance of the new Terms.
                                </p>
                            </section>

                            <hr className="border-border my-8" />

                            <section>
                                <h2 className="text-xl md:text-2xl font-semibold text-primary mb-4">
                                    Contact Us
                                </h2>
                                <p className="text-muted-foreground">
                                    If you have any questions about these Terms and Conditions, please contact us at:{" "}
                                    <a
                                        href="mailto:info.kamatvishal@gmail.com"
                                        className="text-primary font-medium hover:underline transition-all"
                                    >
                                        info.kamatvishal@gmail.com
                                    </a>
                                </p>
                            </section>
                        </div>
                    </div>
                </div>
            </main>

            {/* Footer */}
            <footer className="w-full py-8 text-center text-muted-foreground text-sm border-t border-border bg-card">
                <p>&copy; {currentYear} GPS-ERP. All rights reserved.</p>
                <div className="mt-2 text-xs">
                    <Link href="/privacy-policy" className="hover:text-primary mr-4">Privacy Policy</Link>
                    <Link href="/terms-n-condition" className="hover:text-primary">Terms & Conditions</Link>
                </div>
            </footer>
        </div>
    );
}
