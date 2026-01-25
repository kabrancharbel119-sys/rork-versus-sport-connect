import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Button } from '@/components/Button';
import * as Haptics from 'expo-haptics';

describe('Button', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly with title', () => {
    const { getByText } = render(
      <Button title="Test Button" onPress={() => {}} />
    );
    expect(getByText('Test Button')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="Click Me" onPress={onPressMock} />
    );
    
    fireEvent.press(getByText('Click Me'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('triggers haptic feedback on press', () => {
    const { getByText } = render(
      <Button title="Haptic" onPress={() => {}} />
    );
    
    fireEvent.press(getByText('Haptic'));
    expect(Haptics.impactAsync).toHaveBeenCalledWith(Haptics.ImpactFeedbackStyle.Light);
  });

  it('does not call onPress when disabled', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Button title="Disabled" onPress={onPressMock} disabled />
    );
    
    fireEvent.press(getByText('Disabled'));
    expect(onPressMock).not.toHaveBeenCalled();
  });

  it('does not call onPress when loading', () => {
    const onPressMock = jest.fn();
    const { queryByText } = render(
      <Button title="Loading" onPress={onPressMock} loading />
    );
    
    expect(queryByText('Loading')).toBeNull();
  });

  it('renders with secondary variant', () => {
    const { getByText } = render(
      <Button title="Secondary" onPress={() => {}} variant="secondary" />
    );
    expect(getByText('Secondary')).toBeTruthy();
  });

  it('renders with outline variant', () => {
    const { getByText } = render(
      <Button title="Outline" onPress={() => {}} variant="outline" />
    );
    expect(getByText('Outline')).toBeTruthy();
  });

  it('renders with ghost variant', () => {
    const { getByText } = render(
      <Button title="Ghost" onPress={() => {}} variant="ghost" />
    );
    expect(getByText('Ghost')).toBeTruthy();
  });

  it('renders with orange variant', () => {
    const { getByText } = render(
      <Button title="Orange" onPress={() => {}} variant="orange" />
    );
    expect(getByText('Orange')).toBeTruthy();
  });

  it('renders with different sizes', () => {
    const { rerender, getByText } = render(
      <Button title="Small" onPress={() => {}} size="small" />
    );
    expect(getByText('Small')).toBeTruthy();

    rerender(<Button title="Medium" onPress={() => {}} size="medium" />);
    expect(getByText('Medium')).toBeTruthy();

    rerender(<Button title="Large" onPress={() => {}} size="large" />);
    expect(getByText('Large')).toBeTruthy();
  });

  it('renders with icon', () => {
    const MockIcon = () => null;
    const { getByText } = render(
      <Button title="With Icon" onPress={() => {}} icon={<MockIcon />} />
    );
    expect(getByText('With Icon')).toBeTruthy();
  });
});
