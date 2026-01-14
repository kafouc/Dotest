# Onboarding Tutorial App

## Description
This project is an onboarding tutorial application designed to guide new users through the initial steps of using the app. It features a simple user interface that includes a "Start" button on the homepage, which triggers a tutorial overlay. After completing the tutorial, users are prompted to sign up to use the application.

## Features
- **Interactive Tutorial**: A step-by-step guide that helps users understand the application.
- **Signup Prompt**: Users are encouraged to sign up after completing the tutorial.
- **Responsive Design**: The application is designed to work on various screen sizes.

## Project Structure
```
onboarding-tutorial-app
├── public
│   └── index.html          # Main HTML file for the application
├── src
│   ├── components
│   │   ├── AppLayout.tsx   # Main layout component with the "Start" button
│   │   ├── SignupDialog.tsx # Component for the signup form
│   │   └── TutorialOverlay.tsx # Component that displays the tutorial
│   ├── hooks
│   │   └── useTutorial.ts   # Custom hook for managing tutorial state
│   ├── pages
│   │   └── Home.tsx        # Homepage component
│   ├── styles
│   │   └── globals.css      # Global styles for the application
│   ├── main.tsx            # Entry point of the application
│   └── vite-env.d.ts       # Type declarations for Vite
├── package.json             # npm configuration file
├── tsconfig.json            # TypeScript configuration file
├── tsconfig.node.json       # Node.js specific TypeScript configuration
└── vite.config.ts           # Vite configuration file
```

## Installation
1. Clone the repository:
   ```
   git clone https://github.com/kafouc/Dotest.git
   cd Dotest/onboarding-tutorial-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm run dev
   ```

4. Open your browser and navigate to `http://localhost:3000` to view the application.

## Usage
- Click the "Start" button on the homepage to begin the tutorial.
- Follow the instructions provided in the tutorial overlay.
- After completing the tutorial, fill out the signup form to create an account.

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for details.