# See /LICENSE for more information.
# This is free software, licensed under the GNU General Public License v2.

include $(TOPDIR)/rules.mk

LUCI_TITLE:=LuCI webcam app for js based luci
LUCI_DEPENDS:=+luci-base
LUCI_PKGARCH:=all

PKG_LICENSE:=GPL-2.0
PKG_MAINTAINER:=Camillo Fagnano <camillo.fagnano@gmail.com>

include ../../luci.mk

# call BuildPackage - OpenWrt buildroot signature
