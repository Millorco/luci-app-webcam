# See /LICENSE for more information.
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI Webcam app for gPhoto
LUCI_DEPENDS:=+luci-base2
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0
PKG_MAINTAINER:=Camillo Fagnano <camillo.fagnano@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
