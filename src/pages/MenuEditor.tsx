import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, Plus, Trash2, Upload, FileJson, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AppLayout } from "@/components/layout/AppLayout";
import type { MenuItem, MenuCategory, Menu, MenuConfiguration } from "@/types";

const EXAMPLE_MENUS = {
  simple: {
    name: "Simple Menu",
    description: "A basic menu with a few items and modifier groups",
    data: {
      "items": [
        {
          "id": "Coffee",
          "description": { "translations": { "en_us": "Deliciously roasted beans" } },
          "title": { "translations": { "en_us": "Coffee" } },
          "modifier_group_ids": { "ids": ["Add-milk", "Add-sugar"] },
          "price_info": { "price": 300 },
          "tax_info": { "tax_rate": 8 }
        },
        {
          "id": "Tea",
          "description": { "translations": { "en_us": "A soothing cuppa" } },
          "title": { "translations": { "en_us": "Tea" } },
          "modifier_group_ids": { "ids": ["Add-milk", "Add-sugar"] },
          "price_info": { "price": 250 },
          "tax_info": { "tax_rate": 8 }
        },
        {
          "id": "Milk",
          "title": { "translations": { "en_us": "Milk" } },
          "quantity_info": {
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Add-milk",
              "quantity": { "max_permitted": 1 }
            }]
          },
          "price_info": {
            "price": 0,
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Add-milk",
              "price": 0
            }]
          },
          "tax_info": { "tax_rate": 8 }
        },
        {
          "id": "Sugar",
          "title": { "translations": { "en_us": "Sugar" } },
          "quantity_info": {
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Add-sugar",
              "quantity": { "max_permitted": 2 }
            }]
          },
          "price_info": {
            "price": 2,
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Add-sugar",
              "price": 0
            }]
          },
          "tax_info": { "tax_rate": 8 }
        }
      ],
      "modifier_groups": [
        {
          "id": "Add-milk",
          "title": { "translations": { "en_us": "Add milk" } },
          "quantity_info": { "quantity": { "max_permitted": 1 } },
          "modifier_options": [{ "type": "ITEM", "id": "Milk" }]
        },
        {
          "id": "Add-sugar",
          "title": { "translations": { "en_us": "Add sugar" } },
          "quantity_info": { "quantity": { "max_permitted": 2 } },
          "modifier_options": [{ "type": "ITEM", "id": "Sugar" }]
        }
      ],
      "categories": [
        {
          "id": "Drinks",
          "title": { "translations": { "en_us": "Drinks" } },
          "entities": [
            { "type": "ITEM", "id": "Coffee" },
            { "type": "ITEM", "id": "Tea" }
          ]
        }
      ],
      "menus": [{
        "id": "All-day",
        "title": { "translations": { "en_us": "All day" } },
        "service_availability": [
          { "day_of_week": "monday", "time_periods": [{ "start_time": "00:00", "end_time": "23:59" }] },
          { "day_of_week": "tuesday", "time_periods": [{ "start_time": "00:00", "end_time": "23:59" }] },
          { "day_of_week": "wednesday", "time_periods": [{ "start_time": "00:00", "end_time": "23:59" }] },
          { "day_of_week": "thursday", "time_periods": [{ "start_time": "00:00", "end_time": "23:59" }] },
          { "day_of_week": "friday", "time_periods": [{ "start_time": "00:00", "end_time": "23:59" }] },
          { "day_of_week": "saturday", "time_periods": [{ "start_time": "00:00", "end_time": "23:59" }] },
          { "day_of_week": "sunday", "time_periods": [{ "start_time": "00:00", "end_time": "23:59" }] }
        ],
        "category_ids": ["Drinks"]
      }],
      "display_options": {}
    }
  },
  chargeAbove: {
    name: "Charge Above Example",
    description: "Demonstrates charge_above (first 2 sauces free, then $1 each)",
    data: {
      "items": [
        {
          "id": "Barbeque-sauce",
          "title": { "translations": { "en_us": "Barbeque sauce" } },
          "quantity_info": {
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Choose-sauces",
              "quantity": { "max_permitted": 10 }
            }]
          },
          "price_info": {
            "price": 0,
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Choose-sauces",
              "price": 100
            }]
          },
          "tax_info": { "tax_rate": 8 }
        },
        {
          "id": "Honey-mustard-sauce",
          "title": { "translations": { "en_us": "Honey mustard sauce" } },
          "quantity_info": {
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Choose-sauces",
              "quantity": { "max_permitted": 10 }
            }]
          },
          "price_info": {
            "price": 0,
            "overrides": [{
              "context_type": "MODIFIER_GROUP",
              "context_value": "Choose-sauces",
              "price": 100
            }]
          },
          "tax_info": { "tax_rate": 8 }
        }
      ],
      "modifier_groups": [{
        "id": "Choose-sauces",
        "title": { "translations": { "en_us": "Choose sauces" } },
        "quantity_info": { "quantity": { "charge_above": 2 } },
        "modifier_options": [
          { "type": "ITEM", "id": "Barbeque-sauce" },
          { "type": "ITEM", "id": "Honey-mustard-sauce" }
        ]
      }],
      "categories": [],
      "menus": [],
      "display_options": {}
    }
  },
  dietary: {
    name: "Dietary Labels Example",
    description: "Items with dietary information (vegan, vegetarian, gluten-free)",
    data: {
      "items": [
        {
          "id": "item1",
          "title": { "translations": { "default": "Vegetarian Salad" } },
          "price_info": { "price": 1000 },
          "dish_info": {
            "classifications": {
              "dietary_label_info": { "labels": ["VEGETARIAN", "GLUTEN_FREE"] }
            }
          },
          "tax_info": {}
        },
        {
          "id": "item2",
          "title": { "translations": { "default": "Vegan Buddha Bowl" } },
          "price_info": { "price": 1200 },
          "dish_info": {
            "classifications": {
              "dietary_label_info": { "labels": ["VEGETARIAN", "VEGAN", "GLUTEN_FREE"] }
            }
          },
          "tax_info": {}
        }
      ],
      "modifier_groups": [],
      "categories": [],
      "menus": [],
      "display_options": {}
    }
  }
};

export default function MenuEditor() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [selectedRestaurant, setSelectedRestaurant] = useState("");
  const [restaurants, setRestaurants] = useState<any[]>([]);
  const [loadingRestaurants, setLoadingRestaurants] = useState(true);
  const [activeTab, setActiveTab] = useState("simple");
  
  // Menu structure
  const [menuData, setMenuData] = useState<MenuConfiguration>({
    menus: [],
    categories: [],
    items: [],
    modifier_groups: [],
  });

  // JSON editor
  const [jsonInput, setJsonInput] = useState("");
  const [jsonError, setJsonError] = useState("");

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

  const handleLoadExample = (exampleKey: keyof typeof EXAMPLE_MENUS) => {
    const example = EXAMPLE_MENUS[exampleKey];
    setJsonInput(JSON.stringify(example.data, null, 2));
    setJsonError("");
    toast({
      title: "Example Loaded",
      description: `Loaded: ${example.name}`,
    });
  };

  const handleParseJson = () => {
    try {
      const parsed = JSON.parse(jsonInput);
      setMenuData(parsed);
      setJsonError("");
      toast({
        title: "Success",
        description: "JSON parsed successfully",
      });
      setActiveTab("simple");
    } catch (error: any) {
      setJsonError(error.message);
      toast({
        title: "Error",
        description: "Invalid JSON format",
        variant: "destructive",
      });
    }
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
            { day_of_week: "monday", time_periods: [{ start_time: "00:00", end_time: "23:59" }] },
            { day_of_week: "tuesday", time_periods: [{ start_time: "00:00", end_time: "23:59" }] },
            { day_of_week: "wednesday", time_periods: [{ start_time: "00:00", end_time: "23:59" }] },
            { day_of_week: "thursday", time_periods: [{ start_time: "00:00", end_time: "23:59" }] },
            { day_of_week: "friday", time_periods: [{ start_time: "00:00", end_time: "23:59" }] },
            { day_of_week: "saturday", time_periods: [{ start_time: "00:00", end_time: "23:59" }] },
            { day_of_week: "sunday", time_periods: [{ start_time: "00:00", end_time: "23:59" }] },
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
      <div className="container mx-auto p-6 max-w-6xl">
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

          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="simple">Simple Form</TabsTrigger>
              <TabsTrigger value="json">JSON Editor</TabsTrigger>
              <TabsTrigger value="examples">Examples</TabsTrigger>
            </TabsList>

            {/* Simple Form Tab */}
            <TabsContent value="simple" className="space-y-6">
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
                            <h4 className="font-semibold">{item.title.translations.en || item.title.translations.en_us || item.title.translations.default || "Untitled"}</h4>
                            <p className="text-sm text-muted-foreground">
                              ID: {item.id} | Price: ${(item.price_info.price / 100).toFixed(2)}
                            </p>
                            {item.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {item.description.translations.en || item.description.translations.en_us || item.description.translations.default}
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
            </TabsContent>

            {/* JSON Editor Tab */}
            <TabsContent value="json" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>JSON Menu Configuration</CardTitle>
                  <CardDescription>
                    Paste your complete menu JSON here. Supports all Uber Eats menu features including
                    modifiers, dietary labels, visibility rules, and more.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="json-input">Menu JSON</Label>
                    <Textarea
                      id="json-input"
                      value={jsonInput}
                      onChange={(e) => {
                        setJsonInput(e.target.value);
                        setJsonError("");
                      }}
                      placeholder='{"items": [...], "menus": [...], "categories": [...], "modifier_groups": [...]}'
                      className="font-mono text-sm min-h-[400px]"
                    />
                    {jsonError && (
                      <p className="text-sm text-destructive">{jsonError}</p>
                    )}
                  </div>
                  <Button onClick={handleParseJson} className="w-full">
                    <FileJson className="mr-2 h-4 w-4" />
                    Parse and Load JSON
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Examples Tab */}
            <TabsContent value="examples" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Menu Examples</CardTitle>
                  <CardDescription>
                    Load pre-built examples to get started quickly
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {Object.entries(EXAMPLE_MENUS).map(([key, example]) => (
                    <div
                      key={key}
                      className="flex items-start justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <h4 className="font-semibold">{example.name}</h4>
                        <p className="text-sm text-muted-foreground mt-1">
                          {example.description}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleLoadExample(key as keyof typeof EXAMPLE_MENUS)}
                      >
                        <BookOpen className="mr-2 h-4 w-4" />
                        Load
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

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