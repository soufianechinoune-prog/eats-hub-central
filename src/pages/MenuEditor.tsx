import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import type { MenuItem, MenuCategory, Menu, ModifierGroup, MenuConfiguration } from "@/types";

export default function MenuEditor() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  
  // Menu structure
  const [menuData, setMenuData] = useState<MenuConfiguration>({
    menus: [],
    categories: [],
    items: [],
    modifier_groups: [],
  });

  // Fetch restaurants on mount
  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const { data, error } = await supabase
          .from("restaurants")
          .select("id, name, uber_store_id")
          .not("uber_store_id", "is", null)
          .order("name");

        if (error) throw error;
        setRestaurants(data || []);
      } catch (error) {
        console.error("Error fetching restaurants:", error);
        toast({
          title: "Error",
          description: "Failed to load restaurants",
          variant: "destructive",
        });
      } finally {
        setLoadingRestaurants(false);
      }
    };

    fetchRestaurants();
  }, [toast]);

  // Simple form for adding a menu item
  const [newItem, setNewItem] = useState<Partial<MenuItem>>({
    id: "",
    title: { translations: { en: "" } },
    description: { translations: { en: "" } },
    price_info: { price: 0 },
    tax_info: {},
  });

  const handleAddItem = () => {
    if (!newItem.id || !newItem.title?.translations.en) {
      toast({
        title: "Error",
        description: "Please fill in item ID and title",
        variant: "destructive",
      });
      return;
    }

    const item: MenuItem = {
      id: newItem.id,
      title: newItem.title!,
      description: newItem.description,
      price_info: newItem.price_info!,
      tax_info: newItem.tax_info!,
      image_url: newItem.image_url,
    };

    setMenuData((prev) => ({
      ...prev,
      items: [...prev.items, item],
    }));

    // Reset form
    setNewItem({
      id: "",
      title: { translations: { en: "" } },
      description: { translations: { en: "" } },
      price_info: { price: 0 },
      tax_info: {},
    });

    toast({
      title: "Success",
      description: "Item added to menu",
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setMenuData((prev) => ({
      ...prev,
      items: prev.items.filter((item) => item.id !== itemId),
    }));
  };

  const handleUploadMenu = async () => {
    if (!selectedRestaurant) {
      toast({
        title: "Error",
        description: "Please select a restaurant",
        variant: "destructive",
      });
      return;
    }

    if (menuData.items.length === 0) {
      toast({
        title: "Error",
        description: "Please add at least one item to the menu",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create a basic menu structure if not exists
      if (menuData.menus.length === 0) {
        const defaultMenu: Menu = {
          id: "main-menu",
          title: { translations: { en: "Main Menu" } },
          service_availability: [
            {
              day_of_week: "monday",
              time_periods: [{ start_time: "00:00", end_time: "23:59" }],
            },
            {
              day_of_week: "tuesday",
              time_periods: [{ start_time: "00:00", end_time: "23:59" }],
            },
            {
              day_of_week: "wednesday",
              time_periods: [{ start_time: "00:00", end_time: "23:59" }],
            },
            {
              day_of_week: "thursday",
              time_periods: [{ start_time: "00:00", end_time: "23:59" }],
            },
            {
              day_of_week: "friday",
              time_periods: [{ start_time: "00:00", end_time: "23:59" }],
            },
            {
              day_of_week: "saturday",
              time_periods: [{ start_time: "00:00", end_time: "23:59" }],
            },
            {
              day_of_week: "sunday",
              time_periods: [{ start_time: "00:00", end_time: "23:59" }],
            },
          ],
          category_ids: ["default-category"],
        };

        const defaultCategory: MenuCategory = {
          id: "default-category",
          title: { translations: { en: "All Items" } },
          entities: menuData.items.map((item) => ({ id: item.id, type: "ITEM" as const })),
        };

        menuData.menus = [defaultMenu];
        menuData.categories = [defaultCategory];
      }

      const { data, error } = await supabase.functions.invoke("uber-menu-upload", {
        body: {
          restaurantId: selectedRestaurant,
          menuConfiguration: menuData,
        },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Menu uploaded successfully to Uber Eats",
      });

      navigate("/restaurants");
    } catch (error: any) {
      console.error("Upload error:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to upload menu",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/restaurants")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Menu Editor</h1>
            <p className="text-muted-foreground">Create and upload menus to Uber Eats</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Restaurant Selection */}
          <Card>
            <CardHeader>
              <CardTitle>Select Restaurant</CardTitle>
              <CardDescription>Choose the restaurant to upload the menu for</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingRestaurants ? (
                <p className="text-muted-foreground">Loading restaurants...</p>
              ) : restaurants.length === 0 ? (
                <p className="text-muted-foreground">
                  No restaurants with Uber Eats connection found. Please connect a restaurant to
                  Uber Eats first.
                </p>
              ) : (
                <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a restaurant" />
                  </SelectTrigger>
                  <SelectContent>
                    {restaurants.map((restaurant) => (
                      <SelectItem key={restaurant.id} value={restaurant.id}>
                        {restaurant.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </CardContent>
          </Card>

          {/* Add Item Form */}
          <Card>
            <CardHeader>
              <CardTitle>Add Menu Item</CardTitle>
              <CardDescription>Create a new item for your menu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="item-id">Item ID *</Label>
                  <Input
                    id="item-id"
                    value={newItem.id}
                    onChange={(e) => setNewItem({ ...newItem, id: e.target.value })}
                    placeholder="e.g., burger-classic"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="item-price">Price (cents) *</Label>
                  <Input
                    id="item-price"
                    type="number"
                    value={newItem.price_info?.price || 0}
                    onChange={(e) =>
                      setNewItem({
                        ...newItem,
                        price_info: { ...newItem.price_info!, price: parseInt(e.target.value) || 0 },
                      })
                    }
                    placeholder="e.g., 999 for $9.99"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-title">Title (English) *</Label>
                <Input
                  id="item-title"
                  value={newItem.title?.translations.en || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      title: { translations: { en: e.target.value } },
                    })
                  }
                  placeholder="e.g., Classic Burger"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-description">Description (English)</Label>
                <Textarea
                  id="item-description"
                  value={newItem.description?.translations.en || ""}
                  onChange={(e) =>
                    setNewItem({
                      ...newItem,
                      description: { translations: { en: e.target.value } },
                    })
                  }
                  placeholder="e.g., Juicy beef patty with lettuce, tomato..."
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="item-image">Image URL</Label>
                <Input
                  id="item-image"
                  type="url"
                  value={newItem.image_url || ""}
                  onChange={(e) => setNewItem({ ...newItem, image_url: e.target.value })}
                  placeholder="https://example.com/image.jpg"
                />
              </div>

              <Button onClick={handleAddItem} className="w-full">
                <Plus className="mr-2 h-4 w-4" />
                Add Item
              </Button>
            </CardContent>
          </Card>

          {/* Items List */}
          <Card>
            <CardHeader>
              <CardTitle>Menu Items ({menuData.items.length})</CardTitle>
              <CardDescription>Items that will be uploaded to Uber Eats</CardDescription>
            </CardHeader>
            <CardContent>
              {menuData.items.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No items added yet</p>
              ) : (
                <div className="space-y-2">
                  {menuData.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">{item.title.translations.en}</h4>
                        <p className="text-sm text-muted-foreground">
                          ID: {item.id} | Price: ${(item.price_info.price / 100).toFixed(2)}
                        </p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description.translations.en}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveItem(item.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upload Button */}
          <Button
            onClick={handleUploadMenu}
            disabled={loading || !selectedRestaurant || menuData.items.length === 0}
            className="w-full"
            size="lg"
          >
            <Upload className="mr-2 h-4 w-4" />
            {loading ? "Uploading..." : "Upload Menu to Uber Eats"}
          </Button>
        </div>
      </div>
    </AppLayout>
  );
}
