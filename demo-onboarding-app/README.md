# Demo Onboarding App

This project is a demonstration onboarding application designed to guide new users through a tutorial upon their first visit. The application features a welcoming interface with a "Start" button that triggers a tutorial modal, followed by a prompt for user registration.

## Project Structure

```
demo-onboarding-app
├── src
│   ├── index.tsx          # Entry point of the application
│   ├── App.tsx            # Main application component managing routes
│   ├── components          # Reusable components
│   │   ├── Hero.tsx       # Welcome message and start button
│   │   ├── TutorialModal.tsx # Modal displaying tutorial instructions
│   │   └── SignupPrompt.tsx  # User registration prompt
│   ├── pages
│   │   └── Home.tsx       # Home page including Hero component
│   └── styles
│       └── global.css     # Global styles for the application
├── public
│   └── index.html         # Main HTML file loading the React app
├── package.json           # npm configuration file
├── tsconfig.json          # TypeScript configuration file
└── README.md              # Project documentation
```

## Features

- **User Onboarding**: A tutorial modal that guides users through the application features.
- **Registration Prompt**: A prompt for users to sign up after completing the tutorial.
- **Responsive Design**: The application is styled to be user-friendly on various devices.

## Getting Started

1. Clone the repository:
   ```
   git clone https://github.com/kafouc/Dotest.git
   cd demo-onboarding-app
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the application:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000` to view the application.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.