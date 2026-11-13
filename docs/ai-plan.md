AI-Assisted Development Workflow

1. Development Approach

For this Library Management System assessment, I followed a structured AI-assisted development approach using Claude and GitHub Copilot.

Instead of directly asking GitHub Copilot to analyze the entire assessment and implement the application, I first used Claude for requirement analysis, implementation planning, and prompt preparation.

This approach helped me organize the development process, reduce unnecessary AI token consumption, avoid unclear implementation instructions, and maintain consistency throughout the project.

2. Step-by-Step Workflow

Step 1: Assessment Analysis Using Claude

I initially shared the assessment requirements received through the interview email with Claude.

I asked Claude to:

CONTEXT: I have been given an assesment task as part of an job interview, I want to finish this task by 13th novemeber.

What I want you to do:
- I want you to analyze the assessment objective and design a phase by phase implementation plan
- I want the plan as an md file so that I can feed to the vs code copilot and start with the implementation
- I want the plan to be step by step and also have clear explanation of each steps
- Do not complicate on the logic make the application as simple as possible but it should meet the requirements asked.
- I am thinking of putting both front end and backend in a single repo, so plan accordingly
- TECH Stack: MERN

3. Prepare Instructions for GitHub Copilot

Before starting implementation(IMPLEMENTATION_PLAN.md), I asked Claude another question:

" What do I tell the vscode copilot after attaching this implementation plan md file to start the impementation?

Can you draft a prompt for the above "

4. Phase-by-Phase Implementation Using GitHub Copilot

After preparing the implementation plan and initial instructions, I provided both IMPLEMENTATION_PLAN.md and Claude's suggested prompt to GitHub Copilot in VS Code.

I then instructed Copilot to implement one phase at a time rather than generating the entire application at once.

For every phase, I followed a consistent instruction:

Follow the implementation plan in the specified order.

Implement only the requested phase.

Add the tests mentioned in that phase.

Avoid modifying unrelated files or existing functionality.

Run the relevant tests after implementation.

Provide a summary of the files created or modified and the changes made.

Report any uncertainties or issues.

This approach helped maintain a controlled and organized development process.

5. Review, Testing, and Improvements

After each implementation phase, I reviewed the generated code and tested the functionality.

Whenever I identified issues or wanted improvements, I provided additional instructions to Copilot to address them without affecting existing functionality.

I also used AI assistance to improve the user interface, fix bugs, validate application flows, and complete the project documentation.

6. Final Documentation and Deployment

After completing the implementation, I focused on:

Testing the major application workflows.

Verifying member and administrator functionality.

Checking frontend and backend integration.

Preparing the README and other requested documentation.

Pushing the completed project to GitHub.

Deploying the frontend using Netlify.

Preparing screenshots and submission materials.