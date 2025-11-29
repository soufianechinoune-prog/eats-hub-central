import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface MenuItem {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  price_uber: number | null;
  price_deliveroo: number | null;
  food_cost: number | null;
  is_active: boolean;
}

export interface FieldChange {
  field: string;
  fieldLabel: string;
  from: string | number | boolean | null;
  to: string | number | boolean | null;
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nom",
  category: "Catégorie",
  description: "Description",
  price_uber: "Prix Uber",
  price_deliveroo: "Prix Deliveroo",
  food_cost: "Food Cost",
  is_active: "Statut",
};

export function useMenuItemTracking() {
  const { toast } = useToast();

  // Detect changes between old and new item data
  const detectChanges = (
    oldItem: MenuItem | null,
    newData: Partial<MenuItem>
  ): FieldChange[] => {
    const changes: FieldChange[] = [];

    if (!oldItem) {
      // Creating new item - record all non-null values
      Object.entries(newData).forEach(([key, value]) => {
        if (value !== null && value !== undefined && value !== "" && FIELD_LABELS[key]) {
          changes.push({
            field: key,
            fieldLabel: FIELD_LABELS[key],
            from: null,
            to: value as string | number | boolean,
          });
        }
      });
    } else {
      // Updating existing item - compare values
      const fieldsToCompare = ["name", "category", "description", "price_uber", "price_deliveroo", "food_cost", "is_active"];
      
      fieldsToCompare.forEach((field) => {
        const oldValue = oldItem[field as keyof MenuItem];
        const newValue = newData[field as keyof MenuItem];
        
        // Normalize values for comparison
        const normalizedOld = oldValue === undefined ? null : oldValue;
        const normalizedNew = newValue === undefined ? null : newValue;
        
        if (normalizedOld !== normalizedNew) {
          changes.push({
            field,
            fieldLabel: FIELD_LABELS[field] || field,
            from: normalizedOld as string | number | boolean | null,
            to: normalizedNew as string | number | boolean | null,
          });
        }
      });
    }

    return changes;
  };

  // Record price changes in price_history table
  const recordPriceHistory = async (
    menuItemId: string,
    changes: FieldChange[],
    actionId?: string,
    notes?: string
  ) => {
    const priceFields = ["price_uber", "price_deliveroo", "food_cost"];
    const priceChanges = changes.filter((c) => priceFields.includes(c.field));

    if (priceChanges.length === 0) return;

    const records = priceChanges.map((change) => ({
      menu_item_id: menuItemId,
      field_name: change.field,
      old_value: change.from as number | null,
      new_value: change.to as number | null,
      restaurant_action_id: actionId || null,
      notes: notes || null,
    }));

    const { error } = await supabase.from("price_history").insert(records);

    if (error) {
      console.error("Error recording price history:", error);
    }
  };

  // Record menu item changes
  const recordMenuItemChange = async (
    changeType: "created" | "updated" | "deleted" | "activated" | "deactivated",
    menuItemId: string | null,
    itemName: string,
    changes: FieldChange[],
    notes?: string
  ): Promise<string | null> => {
    const { data, error } = await supabase
      .from("menu_item_changes")
      .insert({
        menu_item_id: menuItemId,
        change_type: changeType,
        item_name: itemName,
        field_changes: changes.map((c) => ({
          field: c.field,
          from: c.from,
          to: c.to,
        })),
        notes: notes || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error recording menu item change:", error);
      return null;
    }

    return data?.id || null;
  };

  // Create a restaurant action for the change
  const createRestaurantAction = async (
    changeType: "created" | "updated" | "deleted" | "activated" | "deactivated",
    itemName: string,
    changes: FieldChange[],
    notes?: string
  ): Promise<string | null> => {
    // Determine action category and type based on change
    let category = "menu";
    let actionType = "modification_menu";
    let title = "";

    const priceChanges = changes.filter((c) => c.field.includes("price") || c.field === "food_cost");

    switch (changeType) {
      case "created":
        actionType = "nouveau_produit";
        title = `Ajout produit: ${itemName}`;
        break;
      case "deleted":
        actionType = "suppression_produit";
        title = `Suppression produit: ${itemName}`;
        break;
      case "activated":
        actionType = "activation_produit";
        title = `Activation produit: ${itemName}`;
        break;
      case "deactivated":
        actionType = "desactivation_produit";
        title = `Désactivation produit: ${itemName}`;
        break;
      case "updated":
        if (priceChanges.length > 0) {
          category = "pricing";
          actionType = "modification_prix";
          title = `Modification prix: ${itemName}`;
        } else {
          actionType = "modification_produit";
          title = `Modification produit: ${itemName}`;
        }
        break;
    }

    // Build change context
    const changeContext = {
      item_name: itemName,
      change_type: changeType,
      changes: changes.map((c) => ({
        field: c.field,
        from: c.from,
        to: c.to,
      })),
    };

    const { data, error } = await supabase
      .from("restaurant_actions")
      .insert({
        category,
        action_type: actionType,
        title,
        description: notes || `${getChangeTypeDescription(changeType)} pour ${itemName}`,
        start_date: new Date().toISOString().split("T")[0],
        platform: "all",
        change_context: changeContext,
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error creating restaurant action:", error);
      return null;
    }

    return data?.id || null;
  };

  // Full tracking flow
  const trackChange = async (
    changeType: "created" | "updated" | "deleted" | "activated" | "deactivated",
    menuItemId: string | null,
    itemName: string,
    changes: FieldChange[],
    notes?: string
  ) => {
    try {
      // 1. Create restaurant action
      const actionId = await createRestaurantAction(changeType, itemName, changes, notes);

      // 2. Record menu item change
      await recordMenuItemChange(changeType, menuItemId, itemName, changes, notes);

      // 3. Record price history if applicable
      if (menuItemId && changes.some((c) => ["price_uber", "price_deliveroo", "food_cost"].includes(c.field))) {
        await recordPriceHistory(menuItemId, changes, actionId || undefined, notes);
      }

      return { success: true, actionId };
    } catch (error) {
      console.error("Error tracking change:", error);
      toast({
        title: "Avertissement",
        description: "Les modifications ont été enregistrées mais le suivi a échoué",
        variant: "destructive",
      });
      return { success: false, actionId: null };
    }
  };

  return {
    detectChanges,
    trackChange,
    recordPriceHistory,
    recordMenuItemChange,
    createRestaurantAction,
  };
}

function getChangeTypeDescription(changeType: string): string {
  switch (changeType) {
    case "created":
      return "Création";
    case "updated":
      return "Modification";
    case "deleted":
      return "Suppression";
    case "activated":
      return "Activation";
    case "deactivated":
      return "Désactivation";
    default:
      return "Modification";
  }
}
