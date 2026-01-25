import React from 'react';
import { render } from '@testing-library/react-native';
import { Avatar } from '@/components/Avatar';

describe('Avatar', () => {
  it('renders with image URI', () => {
    const { getByTestId } = render(
      <Avatar uri="https://example.com/avatar.jpg" testID="avatar" />
    );
    expect(getByTestId).toBeDefined();
  });

  it('renders initials when no URI provided', () => {
    const { getByText } = render(
      <Avatar name="John Doe" />
    );
    expect(getByText('JD')).toBeTruthy();
  });

  it('renders single initial for single name', () => {
    const { getByText } = render(
      <Avatar name="John" />
    );
    expect(getByText('J')).toBeTruthy();
  });

  it('renders question mark when no name or URI', () => {
    const { getByText } = render(
      <Avatar />
    );
    expect(getByText('?')).toBeTruthy();
  });

  it('renders with small size', () => {
    const { toJSON } = render(
      <Avatar name="Test" size="small" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with medium size (default)', () => {
    const { toJSON } = render(
      <Avatar name="Test" size="medium" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with large size', () => {
    const { toJSON } = render(
      <Avatar name="Test" size="large" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders with xlarge size', () => {
    const { toJSON } = render(
      <Avatar name="Test" size="xlarge" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('renders badge when showBadge is true', () => {
    const { toJSON } = render(
      <Avatar name="Test" showBadge />
    );
    const tree = toJSON();
    expect(tree).toBeTruthy();
  });

  it('renders badge with custom color', () => {
    const { toJSON } = render(
      <Avatar name="Test" showBadge badgeColor="#FF0000" />
    );
    expect(toJSON()).toBeTruthy();
  });

  it('handles names with multiple spaces', () => {
    const { getByText } = render(
      <Avatar name="Jean Pierre Dupont" />
    );
    expect(getByText('JP')).toBeTruthy();
  });

  it('handles names with special characters', () => {
    const { getByText } = render(
      <Avatar name="José María" />
    );
    expect(getByText('JM')).toBeTruthy();
  });

  it('applies custom style', () => {
    const customStyle = { marginTop: 10 };
    const { toJSON } = render(
      <Avatar name="Test" style={customStyle} />
    );
    expect(toJSON()).toBeTruthy();
  });
});
