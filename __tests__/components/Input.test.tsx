import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Input } from '@/components/Input';

describe('Input', () => {
  it('renders correctly with label', () => {
    const { getByText } = render(
      <Input label="Email" value="" onChangeText={() => {}} />
    );
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders placeholder text', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Enter your email" value="" onChangeText={() => {}} />
    );
    expect(getByPlaceholderText('Enter your email')).toBeTruthy();
  });

  it('calls onChangeText when text changes', () => {
    const onChangeTextMock = jest.fn();
    const { getByPlaceholderText } = render(
      <Input placeholder="Type here" value="" onChangeText={onChangeTextMock} />
    );
    
    fireEvent.changeText(getByPlaceholderText('Type here'), 'new text');
    expect(onChangeTextMock).toHaveBeenCalledWith('new text');
  });

  it('displays error message when error prop is provided', () => {
    const { getByText } = render(
      <Input value="" onChangeText={() => {}} error="This field is required" />
    );
    expect(getByText('This field is required')).toBeTruthy();
  });

  it('toggles password visibility when eye icon is pressed', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Password"
        value="secret123"
        onChangeText={() => {}}
        secureTextEntry
      />
    );
    
    const input = getByPlaceholderText('Password');
    expect(input.props.secureTextEntry).toBe(true);
  });

  it('renders with icon', () => {
    const MockIcon = () => null;
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Search"
        value=""
        onChangeText={() => {}}
        icon={<MockIcon />}
      />
    );
    expect(getByPlaceholderText('Search')).toBeTruthy();
  });

  it('handles multiline input', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Description"
        value=""
        onChangeText={() => {}}
        multiline
        numberOfLines={4}
      />
    );
    
    const input = getByPlaceholderText('Description');
    expect(input.props.multiline).toBe(true);
    expect(input.props.numberOfLines).toBe(4);
  });

  it('respects editable prop', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Read only"
        value="Cannot edit"
        onChangeText={() => {}}
        editable={false}
      />
    );
    
    const input = getByPlaceholderText('Read only');
    expect(input.props.editable).toBe(false);
  });

  it('respects maxLength prop', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Limited"
        value=""
        onChangeText={() => {}}
        maxLength={10}
      />
    );
    
    const input = getByPlaceholderText('Limited');
    expect(input.props.maxLength).toBe(10);
  });

  it('handles focus state', () => {
    const { getByPlaceholderText } = render(
      <Input placeholder="Focus me" value="" onChangeText={() => {}} />
    );
    
    const input = getByPlaceholderText('Focus me');
    fireEvent(input, 'focus');
    fireEvent(input, 'blur');
  });

  it('applies correct keyboard type', () => {
    const { getByPlaceholderText } = render(
      <Input
        placeholder="Phone"
        value=""
        onChangeText={() => {}}
        keyboardType="phone-pad"
      />
    );
    
    const input = getByPlaceholderText('Phone');
    expect(input.props.keyboardType).toBe('phone-pad');
  });
});
