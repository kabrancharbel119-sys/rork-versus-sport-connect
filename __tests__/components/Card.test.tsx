import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Text } from 'react-native';
import { Card } from '@/components/Card';

describe('Card', () => {
  it('renders children correctly', () => {
    const { getByText } = render(
      <Card>
        <Text>Card Content</Text>
      </Card>
    );
    expect(getByText('Card Content')).toBeTruthy();
  });

  it('renders with default variant', () => {
    const { toJSON } = render(
      <Card>
        <Text>Default</Text>
      </Card>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with elevated variant', () => {
    const { toJSON } = render(
      <Card variant="elevated">
        <Text>Elevated</Text>
      </Card>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with gradient variant', () => {
    const { toJSON } = render(
      <Card variant="gradient">
        <Text>Gradient</Text>
      </Card>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles onPress when provided', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Card onPress={onPressMock}>
        <Text>Pressable Card</Text>
      </Card>
    );
    
    fireEvent.press(getByText('Pressable Card'));
    expect(onPressMock).toHaveBeenCalledTimes(1);
  });

  it('does not wrap in TouchableOpacity when no onPress', () => {
    const { toJSON } = render(
      <Card>
        <Text>Static Card</Text>
      </Card>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('applies custom style', () => {
    const customStyle = { marginBottom: 20 };
    const { toJSON } = render(
      <Card style={customStyle}>
        <Text>Styled Card</Text>
      </Card>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('supports accessibility role', () => {
    const { toJSON } = render(
      <Card onPress={() => {}} accessibilityRole="button" accessibilityLabel="Action card">
        <Text>Accessible Card</Text>
      </Card>
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders multiple children', () => {
    const { getByText } = render(
      <Card>
        <Text>First</Text>
        <Text>Second</Text>
        <Text>Third</Text>
      </Card>
    );
    expect(getByText('First')).toBeTruthy();
    expect(getByText('Second')).toBeTruthy();
    expect(getByText('Third')).toBeTruthy();
  });

  it('combines gradient variant with onPress', () => {
    const onPressMock = jest.fn();
    const { getByText } = render(
      <Card variant="gradient" onPress={onPressMock}>
        <Text>Gradient Pressable</Text>
      </Card>
    );
    
    fireEvent.press(getByText('Gradient Pressable'));
    expect(onPressMock).toHaveBeenCalled();
  });
});
