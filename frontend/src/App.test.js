import { render, screen } from '@testing-library/react';
import App from './App';

test('renders restaurant management app', () => {
  render(<App />);
  const linkElement = screen.getByText(/restaurant management/i);
  expect(linkElement).toBeInTheDocument();
});