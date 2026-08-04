import React, { useState, useCallback, useRef } from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Animated, ScrollView, Dimensions, Text } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { X } from 'lucide-react-native';
import { Colors } from '@/constants/colors';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export interface FullscreenImageViewerRef {
  open: (uris: string | string[], startIndex?: number) => void;
  close: () => void;
}

interface FullscreenImageViewerProps {
  visible: boolean;
  images: string[];
  startIndex: number;
  onClose: () => void;
}

export function FullscreenImageViewer({ visible, images, startIndex, onClose }: FullscreenImageViewerProps) {
  const [currentIndex, setCurrentIndex] = useState(startIndex);
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);

  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / SCREEN_WIDTH);
    if (index !== currentIndex && index >= 0 && index < images.length) {
      setCurrentIndex(index);
    }
  }, [currentIndex, images.length]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        {/* Close button */}
        <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
          <X size={28} color="#FFF" />
        </TouchableOpacity>

        {/* Image pager */}
        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={handleScroll}
          scrollEventThrottle={16}
          style={styles.scrollView}
          contentOffset={{ x: startIndex * SCREEN_WIDTH, y: 0 }}
        >
          {images.map((uri, i) => (
            <View key={i} style={styles.imagePage}>
              <ExpoImage
                source={{ uri }}
                style={styles.image}
                contentFit="contain"
                transition={200}
              />
            </View>
          ))}
        </ScrollView>

        {/* Counter */}
        {images.length > 1 && (
          <View style={styles.counter}>
            <View style={styles.counterDots}>
              {images.map((_, i) => (
                <View
                  key={i}
                  style={[styles.dot, i === currentIndex ? styles.dotActive : styles.dotInactive]}
                />
              ))}
            </View>
            <Text style={styles.counterText}>
              {currentIndex + 1} / {images.length}
            </Text>
          </View>
        )}
      </View>
    </Modal>
  );
}

// Hook for easy usage
export function useFullscreenImage() {
  const [visible, setVisible] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [startIndex, setStartIndex] = useState(0);

  const open = useCallback((uris: string | string[], index: number = 0) => {
    const arr = Array.isArray(uris) ? uris : [uris];
    setImages(arr);
    setStartIndex(index);
    setVisible(true);
  }, []);

  const close = useCallback(() => setVisible(false), []);

  return {
    visible,
    images,
    startIndex,
    open,
    close,
    viewer: (
      <FullscreenImageViewer
        visible={visible}
        images={images}
        startIndex={startIndex}
        onClose={close}
      />
    ),
  };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.97)',
  },
  closeBtn: {
    position: 'absolute',
    top: 56,
    right: 20,
    zIndex: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollView: {
    flex: 1,
  },
  imagePage: {
    width: SCREEN_WIDTH,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  counter: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 10,
  },
  counterDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  dotActive: {
    backgroundColor: '#FFF',
    width: 20,
  },
  dotInactive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  counterText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '500',
  },
});
