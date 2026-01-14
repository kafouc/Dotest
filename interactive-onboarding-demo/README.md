# Interactive Onboarding Demo

This project is an interactive onboarding demo for a web application. It guides new users through the features of the application after they click the "Start" button on the homepage. The demo includes an introduction, a walkthrough of the main functionalities, and a prompt for user registration.

## Project Structure

- **public/index.html**: The homepage of the application, containing the basic HTML structure and necessary scripts for the application to function.
  
- **src/main.ts**: The entry point of the application. It initializes the app, manages the rendering of components, and configures events, including the click event for the "Start" button.

- **src/components/IntroScreen.ts**: Exports the `IntroScreen` component that displays an introduction screen when the user clicks the "Start" button, briefly presenting the application and its features.

- **src/components/DemoWalkthrough.ts**: Exports the `DemoWalkthrough` component that guides the user through the main features of the application. It includes interactive steps and explanations.

- **src/components/SignupPrompt.ts**: Exports the `SignupPrompt` component that appears after the demo, prompting the user to sign up to continue using the application.

- **src/styles/main.css**: Contains the CSS styles for the application, including styles for components and overall layout.

- **src/hooks/useDemoFlow.ts**: Exports a custom hook `useDemoFlow` that manages the state of the demo and transitions between different onboarding steps.

- **tsconfig.json**: TypeScript configuration file that specifies compiler options and files to include in the compilation.

- **package.json**: npm configuration file that lists dependencies and scripts for the project.

## Getting Started

To get started with the project, follow these steps:

1. Clone the repository:
   ```
   git clone https://github.com/kafouc/Dotest.git
   cd Dotest/interactive-onboarding-demo
   ```

2. Install the dependencies:
   ```
   npm install
   ```

3. Run the application:
   ```
   npm start
   ```

4. Open your browser and navigate to `http://localhost:3000` to see the application in action.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request for any enhancements or bug fixes.

## License

This project is licensed under the MIT License. See the LICENSE file for more details.