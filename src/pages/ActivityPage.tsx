import AppHeader from "@/components/AppHeader";
import Layout from "@/components/Layout";
import { Card, CardContent } from "@/components/ui/card";
import { Phone, MapPin, Stethoscope, Syringe, Scissors, Apple, Heart, AlertCircle, Home, ShoppingBag, ExternalLink } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";
import pearlBanner from "@/assets/pearl-pet-hospital-banner.png";

const GOOGLE_MAPS_URL = "https://maps.app.goo.gl/YYhqxSTmXuY4qHc29?g_st=aw";

const ActivityPage = () => {
  const facilities = [
    { icon: Stethoscope, label: "General Checkup" },
    { icon: Syringe, label: "Vaccination" },
    { icon: Scissors, label: "Grooming" },
    { icon: Apple, label: "Pet Nutrition Advise" },
    { icon: Heart, label: "Birth Control Surgeries" },
    { icon: AlertCircle, label: "Emergency Critical Care" },
    { icon: Home, label: "Home Consultation" },
    { icon: ShoppingBag, label: "Pet Accessories" },
  ];

  const openMaps = () => {
    window.open(GOOGLE_MAPS_URL, "_blank");
  };

  return (
    <>
      <AppHeader title="Trove" />
      <Layout>
        <div className="flex flex-col items-center px-4 py-4">
          {/* Banner */}
          <OptimizedImage
            src={pearlBanner}
            alt="Pearl Pet Hospital"
            className="w-full max-w-xs h-auto object-contain"
            containerClassName="w-full max-w-xs mb-3 rounded-lg"
            eager
          />

          {/* Free Offer */}
          <Card className="w-full mb-3 bg-primary/10 border-primary/20">
            <CardContent className="p-2.5 text-center">
              <p className="text-xs font-medium text-primary">
                🎉 Free antirabies vaccine & general check up for first time customers!
              </p>
            </CardContent>
          </Card>

          {/* Facilities */}
          <div className="w-full mb-3">
            <h2 className="text-sm font-semibold text-foreground mb-2">Facilities</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {facilities.map((facility, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1.5 p-1.5 bg-muted/50 rounded-md"
                >
                  <facility.icon className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] text-foreground">{facility.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Contact & Location */}
          <Card className="w-full">
            <CardContent className="p-3 space-y-2">
              <button
                onClick={openMaps}
                className="flex items-start gap-2 w-full text-left hover:bg-muted/50 rounded-md p-1.5 -m-1.5 transition-colors"
              >
                <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-xs text-foreground">
                    Near Master PU College, Mini Vidhana Soudha Road, Kuvempunagar, 2nd Stage, Hassan - 573201
                  </p>
                  <p className="text-[10px] text-primary flex items-center gap-1 mt-1">
                    <ExternalLink className="w-3 h-3" /> Open in Google Maps
                  </p>
                </div>
              </button>
              <div className="flex items-center gap-2 pt-1 border-t border-border">
                <Phone className="w-4 h-4 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  +91 7019621542, 7892588601
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    </>
  );
};

export default ActivityPage;
