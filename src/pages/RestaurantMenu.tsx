import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getMenu } from "@/services/uberService";
import { MenuConfiguration, MenuItem, MenuCategory, ModifierGroup } from "@/types";
import { toast } from "sonner";
import { Loader2, ArrowLeft, Package, Tag, DollarSign } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

export default function RestaurantMenu() {
  const { restaurantId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [menuData, setMenuData] = useState<MenuConfiguration | null>(null);

  useEffect(() => {
    const loadMenu = async () => {
      if (!restaurantId) return;

      try {
        setLoading(true);
        const data = await getMenu(restaurantId);
        setMenuData(data);
      } catch (error: any) {
        console.error("Failed to load menu:", error);
        toast.error("Failed to load menu: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    loadMenu();
  }, [restaurantId]);

  const getTranslation = (multilang: { translations: Record<string, string> }) => {
    return multilang.translations["en_us"] || Object.values(multilang.translations)[0] || "";
  };

  const formatPrice = (price: number) => {
    return (price / 100).toFixed(2) + " €";
  };

  const renderItem = (item: MenuItem) => {
    return (
      <Card key={item.id} className="mb-4">
        <CardHeader>
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <CardTitle className="text-lg">{getTranslation(item.title)}</CardTitle>
              {item.description && (
                <CardDescription className="mt-1">
                  {getTranslation(item.description)}
                </CardDescription>
              )}
            </div>
            {item.image_url && (
              <img
                src={item.image_url}
                alt={getTranslation(item.title)}
                className="w-20 h-20 object-cover rounded ml-4"
              />
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 flex-wrap">
            <Badge variant="secondary" className="flex items-center gap-1">
              <DollarSign className="w-3 h-3" />
              {formatPrice(item.price_info.price)}
            </Badge>
            
            {item.dish_info?.classifications?.dietary_label_info?.labels && (
              <div className="flex gap-1">
                {item.dish_info.classifications.dietary_label_info.labels.map((label) => (
                  <Badge key={label} variant="outline">
                    {label}
                  </Badge>
                ))}
              </div>
            )}

            {item.suspension_info?.suspension?.suspend_until && 
              new Date(item.suspension_info.suspension.suspend_until * 1000) > new Date() && (
              <Badge variant="destructive">Sold Out</Badge>
            )}

            {item.nutritional_info?.calories && (
              <Badge variant="outline">
                {item.nutritional_info.calories.energy_interval?.lower || 
                 item.nutritional_info.calories.lower_range} cal
              </Badge>
            )}
          </div>

          {item.modifier_group_ids && item.modifier_group_ids.ids.length > 0 && (
            <div className="mt-3">
              <p className="text-sm text-muted-foreground">
                Customization options available
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const renderCategory = (category: MenuCategory, items: MenuItem[]) => {
    const categoryItems = items.filter(item =>
      category.entities.some(entity => entity.id === item.id && entity.type === 'ITEM')
    );

    if (categoryItems.length === 0) return null;

    return (
      <AccordionItem key={category.id} value={category.id}>
        <AccordionTrigger className="text-xl font-semibold">
          <div className="flex items-center gap-2">
            <Tag className="w-5 h-5" />
            {getTranslation(category.title)}
            <Badge variant="secondary">{categoryItems.length}</Badge>
          </div>
        </AccordionTrigger>
        <AccordionContent>
          {category.subtitle && (
            <p className="text-muted-foreground mb-4">
              {getTranslation(category.subtitle)}
            </p>
          )}
          <div className="space-y-4">
            {categoryItems.map(renderItem)}
          </div>
        </AccordionContent>
      </AccordionItem>
    );
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh]">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </AppLayout>
    );
  }

  if (!menuData) {
    return (
      <AppLayout>
        <div className="container mx-auto p-6">
          <Card>
            <CardHeader>
              <CardTitle>No Menu Found</CardTitle>
              <CardDescription>Unable to load menu data</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto p-6">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/restaurants")}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Restaurants
          </Button>

          <div className="flex items-center gap-4 mb-4">
            <Package className="w-8 h-8" />
            <div>
              <h1 className="text-3xl font-bold">Restaurant Menu</h1>
              <p className="text-muted-foreground">
                {menuData.menus.length} menu(s), {menuData.categories.length} categories, {menuData.items.length} items
              </p>
            </div>
          </div>
        </div>

        {menuData.menus.length === 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>No Menus Available</CardTitle>
              <CardDescription>
                This restaurant doesn't have any menus configured yet.
              </CardDescription>
            </CardHeader>
          </Card>
        ) : (
          <div className="space-y-6">
            {menuData.menus.map((menu) => {
              const menuCategories = menuData.categories.filter(cat =>
                menu.category_ids.includes(cat.id)
              );

              return (
                <Card key={menu.id}>
                  <CardHeader>
                    <CardTitle className="text-2xl">{getTranslation(menu.title)}</CardTitle>
                    {menu.subtitle && (
                      <CardDescription>{getTranslation(menu.subtitle)}</CardDescription>
                    )}
                    {menu.service_availability.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Available:</p>
                        <div className="flex flex-wrap gap-2 mt-1">
                          {menu.service_availability.map((sa, idx) => (
                            <Badge key={idx} variant="outline">
                              {sa.day_of_week}: {sa.time_periods.map(tp => 
                                `${tp.start_time}-${tp.end_time}`
                              ).join(", ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardHeader>
                  <CardContent>
                    <Accordion type="single" collapsible className="w-full">
                      {menuCategories.map(category => 
                        renderCategory(category, menuData.items)
                      )}
                    </Accordion>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
