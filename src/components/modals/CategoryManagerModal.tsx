import React from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Keyboard,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Plus, Check, Trash2 } from 'lucide-react-native';
import { Palette, Typography } from '../../theme/tokens';
import { Category, TransactionType } from '../../types';
import { AppHaptics } from '../../utils/haptics';
import { ModalHeader } from '../ModalHeader';
import { KeyboardSafeContainer } from '../KeyboardSafeContainer';
import { CategoryIcon, AVAILABLE_ICONS } from '../CategoryIcon';
import { BottomSheetModal } from '../BottomSheetModal';

interface CategoryManagerModalProps {
  visible: boolean;
  categories: Category[];
  activeType: TransactionType;
  showAddForm: boolean;
  newCatName: string;
  newCatIcon: string;
  onChangeActiveType: (type: TransactionType) => void;
  onToggleAddForm: (show: boolean) => void;
  onChangeName: (name: string) => void;
  onChangeIcon: (icon: string) => void;
  onCreateCategory: () => void;
  onSelectCategory: (cat: Category) => void;
  onDeleteCategory: (id: string, name: string) => void;
  onClose: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  visible,
  categories,
  activeType,
  showAddForm,
  newCatName,
  newCatIcon,
  onChangeActiveType,
  onToggleAddForm,
  onChangeName,
  onChangeIcon,
  onCreateCategory,
  onSelectCategory,
  onDeleteCategory,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const filteredCategories = categories.filter((c) => c.type === activeType);
  const activeTint = activeType === 'expense' ? Palette.primary : Palette.accentTeal;

  return (
    <BottomSheetModal
      visible={visible}
      onClose={onClose}
      height="92%"
      maxHeight="94%"
    >
      <ModalHeader
        title="Categories"
        subtitle="Manage expense and income tags"
        onClose={onClose}
      />

            {/* Segmented Control */}
            <View style={styles.segmentedControl}>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  activeType === 'expense' && styles.segmentBtnActiveExpense,
                ]}
                onPress={() => {
                  AppHaptics.selection();
                  onChangeActiveType('expense');
                }}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    activeType === 'expense' && styles.segmentBtnTextActive,
                  ]}
                >
                  Expense ({categories.filter((c) => c.type === 'expense').length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.segmentBtn,
                  activeType === 'income' && styles.segmentBtnActiveIncome,
                ]}
                onPress={() => {
                  AppHaptics.selection();
                  onChangeActiveType('income');
                }}
              >
                <Text
                  style={[
                    styles.segmentBtnText,
                    activeType === 'income' && styles.segmentBtnTextActive,
                  ]}
                >
                  Income ({categories.filter((c) => c.type === 'income').length})
                </Text>
              </TouchableOpacity>
            </View>

            <KeyboardSafeContainer>
              {!showAddForm ? (
                <TouchableOpacity
                  style={styles.openCreatorBtn}
                  onPress={() => {
                    AppHaptics.light();
                    onToggleAddForm(true);
                  }}
                  activeOpacity={0.85}
                >
                  <View style={[styles.plusIconBox, { backgroundColor: activeTint }]}>
                    <Plus size={18} color={Palette.white} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.openCreatorTitle}>
                      Add New {activeType === 'expense' ? 'Expense' : 'Income'} Category
                    </Text>
                  </View>
                </TouchableOpacity>
              ) : (
                <View style={styles.creationBox}>
                  <Text style={styles.inputLabel}>
                    {activeType === 'expense' ? 'Expense' : 'Income'} Category Name
                  </Text>
                  <TextInput
                    style={styles.textInputBox}
                    placeholder="e.g. Subscriptions, Bonus"
                    placeholderTextColor={Palette.mutedSoft}
                    value={newCatName}
                    onChangeText={onChangeName}
                    returnKeyType="done"
                    onSubmitEditing={Keyboard.dismiss}
                  />

                  <Text style={[styles.inputLabel, { marginTop: 14 }]}>
                    Select Icon ({AVAILABLE_ICONS.length} available)
                  </Text>
                  <View style={styles.iconScrollBox}>
                    <ScrollView
                      style={styles.iconScrollView}
                      contentContainerStyle={styles.iconGrid}
                      nestedScrollEnabled={true}
                      showsVerticalScrollIndicator={true}
                    >
                      {AVAILABLE_ICONS.map((ic) => {
                        const active = newCatIcon === ic;
                        return (
                          <TouchableOpacity
                            key={ic}
                            style={[
                              styles.iconCell,
                              active && {
                                backgroundColor: activeTint,
                                borderColor: activeTint,
                              },
                            ]}
                            onPress={() => {
                              AppHaptics.selection();
                              onChangeIcon(ic);
                            }}
                          >
                            <CategoryIcon
                              name={ic}
                              size={20}
                              color={active ? Palette.white : Palette.body}
                            />
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>

                  <View style={styles.inlineActionRow}>
                    <TouchableOpacity
                      style={styles.cancelBtn}
                      onPress={() => {
                        Keyboard.dismiss();
                        onToggleAddForm(false);
                      }}
                    >
                      <Text style={styles.cancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.saveBtn, { backgroundColor: activeTint }]}
                      onPress={onCreateCategory}
                    >
                      <Check size={16} color={Palette.white} style={{ marginRight: 6 }} />
                      <Text style={styles.saveText}>Save Category</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}

              <View style={styles.listHeader}>
                <Text style={styles.listTitle}>
                  {activeType === 'expense' ? 'Expense' : 'Income'} Directory
                </Text>
              </View>

              {filteredCategories.map((cat) => {
                const tint = cat.type === 'expense' ? Palette.primary : Palette.accentTeal;
                const softBg = cat.type === 'expense' ? '#FDF0ED' : '#EBF7F4';
                return (
                  <View key={cat.id} style={styles.listCard}>
                    <TouchableOpacity
                      style={styles.listCardLeft}
                      onPress={() => onSelectCategory(cat)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.listIconBox, { backgroundColor: softBg }]}>
                        <CategoryIcon name={cat.icon} size={20} color={tint} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.listCardName}>{cat.name}</Text>
                        <Text style={styles.listCardMeta}>
                          {cat.isDefault ? 'Standard' : 'Custom'}
                        </Text>
                      </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => onDeleteCategory(cat.id, cat.name)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Trash2 size={16} color={Palette.error} />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </KeyboardSafeContainer>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: Palette.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '92%',
    maxHeight: '94%',
    overflow: 'hidden',
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 14,
    padding: 4,
    marginHorizontal: 20,
    marginTop: 10,
    marginBottom: 4,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    borderRadius: 10,
  },
  segmentBtnActiveExpense: {
    backgroundColor: Palette.primary,
  },
  segmentBtnActiveIncome: {
    backgroundColor: Palette.accentTeal,
  },
  segmentBtnText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.muted,
  },
  segmentBtnTextActive: {
    color: Palette.white,
  },
  openCreatorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Palette.surfaceSoft,
    padding: 12,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  plusIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  openCreatorTitle: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  creationBox: {
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 16,
    padding: 14,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  inputLabel: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.ink,
    marginBottom: 5,
  },
  textInputBox: {
    ...Typography.body,
    fontSize: 14,
    backgroundColor: Palette.white,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: Palette.hairline,
    color: Palette.ink,
  },
  iconScrollBox: {
    maxHeight: 180,
    backgroundColor: Palette.surfaceSoft,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Palette.hairline,
    padding: 8,
  },
  iconScrollView: {
    flexGrow: 0,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingBottom: 4,
  },
  iconCell: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: Palette.white,
    borderWidth: 1,
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inlineActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: Palette.white,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  cancelText: {
    ...Typography.caption,
    fontSize: 12,
    fontWeight: '600',
    color: Palette.muted,
  },
  saveBtn: {
    flex: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  saveText: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.white,
  },
  listHeader: {
    marginBottom: 8,
    marginTop: 4,
  },
  listTitle: {
    ...Typography.subheading,
    fontSize: 14,
    fontWeight: '600',
    color: Palette.ink,
  },
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Palette.white,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Palette.hairline,
  },
  listCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  listIconBox: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  listCardName: {
    ...Typography.body,
    fontSize: 13,
    fontWeight: '600',
    color: Palette.ink,
  },
  listCardMeta: {
    ...Typography.caption,
    fontSize: 11,
    color: Palette.muted,
    marginTop: 1,
  },
  deleteBtn: {
    padding: 6,
  },
});
