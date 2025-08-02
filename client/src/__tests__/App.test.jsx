import React from 'react';
import { render, screen } from '@testing-library/react';
import App from '../App';

describe('App Component', () => {
  test('renders without crashing', () => {
    render(<App />);
    // Oletetaan, että App näyttää jonkin identifioitavan elementin, esim. navbarin title
    expect(screen.getByText(/welcome to datesite/i)).toBeInTheDocument();
  });
});
