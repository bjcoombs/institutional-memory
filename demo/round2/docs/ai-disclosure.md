# User-Facing AI Disclosure

Applicants are informed that an AI system is used in the credit
decision, at two points in the journey.

## Application form

Displayed above the submit button and requiring no scroll:

> "We use an artificial intelligence system to help assess your
> application. It analyses the financial information you provide to
> produce a creditworthiness recommendation. You can ask for an
> explanation of any decision and request that your application be
> reconsidered. See our AI in Lending notice for details."

## Decision communication

Every decision email and letter includes:

> "This decision was made with the assistance of an artificial
> intelligence system. The main factors that influenced the outcome are
> listed above. You have the right to request a review and to receive a
> meaningful explanation of how the decision was reached. To do so,
> contact us at decisions@example.com or via your online account."

## AI in Lending notice

The public notice (published on the website, linked from both texts
above) explains in plain language: what the system does, what data it
uses, that protected characteristics are excluded, how to contest a
decision, and how model quality is monitored.

## Implementation

The disclosure strings are served from `config/disclosure.yaml` so
wording changes are versioned and reviewed by compliance before release.
